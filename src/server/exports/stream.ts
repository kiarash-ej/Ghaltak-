import "server-only";
import { BOM, csvLine, type CsvValue } from "./csv";
import { errorSummary } from "@/lib/error-summary";

// Sends a CSV as it is built: one database batch at a time goes out and is
// forgotten, so memory stays flat however big the store is (C6).

export function csvResponse(filename: string, header: string[], batches: AsyncGenerator<CsvValue[][]>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(BOM + csvLine(header)));
    },
    async pull(controller) {
      try {
        const { value, done } = await batches.next();
        if (done) controller.close();
        else controller.enqueue(encoder.encode(value.map(csvLine).join("")));
      } catch (error) {
        // The error's kind only: its message can quote rows with customers' details (#50).
        console.error("data export failed:", errorSummary(error));
        controller.error(error);
      }
    },
    async cancel() {
      await batches.return(undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
