// Runtime-agnostic helpers to read various body types to text

// Read a WHATWG ReadableStream into a Uint8Array
async function readWebStreamToUint8(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// Read a Node.js Readable stream into a Uint8Array without Buffer dependency
async function readNodeStreamToUint8(stream: any): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let total = 0;
  return new Promise<Uint8Array>((resolve, reject) => {
    try {
      stream.on("data", (chunk: any) => {
        let arr: Uint8Array;
        if (typeof chunk === "string") {
          arr = encoder.encode(chunk);
        } else if (chunk instanceof Uint8Array) {
          arr = chunk;
        } else if (chunk && typeof chunk === "object" &&
                   chunk.buffer instanceof ArrayBuffer &&
                   typeof chunk.byteLength === "number") {
          arr = new Uint8Array(chunk.buffer, chunk.byteOffset ?? 0, chunk.byteLength);
        } else {
          try {
            arr = new Uint8Array(chunk);
          } catch {
            arr = encoder.encode(String(chunk));
          }
        }
        chunks.push(arr);
        total += arr.length;
      });
      stream.on("error", (err: any) => reject(err));
      stream.on("end", () => {
        const result = new Uint8Array(total);
        let offset = 0;
        for (const c of chunks) {
          result.set(c, offset);
          offset += c.length;
        }
        resolve(result);
      });
    } catch (err) {
      reject(err);
    }
  });
}

export async function readBodyToUint8(body: unknown): Promise<Uint8Array> {
  if (body == null) return new Uint8Array();

  // ArrayBuffer
  if (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer) {
    return new Uint8Array(body);
  }

  // Uint8Array or Buffer
  if (body instanceof Uint8Array) {
    return body;
  }

  // WHATWG ReadableStream
  if (typeof (body as any)?.getReader === "function") {
    return readWebStreamToUint8(body as ReadableStream<Uint8Array>);
  }

  // Node.js Readable stream (duck-typed)
  if (typeof (body as any)?.on === "function") {
    return readNodeStreamToUint8(body);
  }

  // Blob-like or Response-like with arrayBuffer()
  if (typeof (body as any)?.arrayBuffer === "function") {
    const ab = await (body as any).arrayBuffer();
    return new Uint8Array(ab);
  }

  // String
  if (typeof body === "string") {
    return new TextEncoder().encode(body);
  }

  // Fallback: try to stringify
  return new TextEncoder().encode(String(body));
}

export async function readBodyToText(body: unknown, encoding: string = "utf-8"): Promise<string> {
  const bytes = await readBodyToUint8(body);
  return new TextDecoder(encoding).decode(bytes);
}

