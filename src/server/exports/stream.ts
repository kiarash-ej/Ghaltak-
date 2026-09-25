import "server-only";
import { BOM, csvLine, type CsvValue } from "./csv";

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
        // The message only: never the rows, which hold customers' details.
        console.error("data export failed:", error instanceof Error ? error.message : "unknown error");
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
