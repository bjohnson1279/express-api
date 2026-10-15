import { FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

// Read every part so fields can arrive before or after the file.
export async function saveMultipartUpload(req: FastifyRequest, fieldname: string, directory: string) {
  const fields: Record<string, string> = {};
  let content: Buffer | undefined;
  let extension = '';
  for await (const part of req.parts({ limits: { files: 1, fields: 10, fileSize: 5 * 1024 * 1024 } })) {
    if (part.type === 'file') {
      const buffer = await part.toBuffer();
      if (part.fieldname !== fieldname) {
        throw Object.assign(new Error('Unexpected file field'), { statusCode: 400 });
      }
      content = buffer;
      extension = path.extname(part.filename).replace(/[^.a-zA-Z0-9]/g, '').slice(0, 12);
    } else {
      fields[part.fieldname] = String(part.value);
    }
  }
  if (!content) throw Object.assign(new Error('No file uploaded'), { statusCode: 400 });
  const filename = randomUUID() + extension;
  const filepath = path.join(directory, filename);
  await mkdir(directory, { recursive: true });
  await writeFile(filepath, content, { flag: 'wx' });
  return { fields, filename, filepath };
}
