const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.ts')) {
            processFile(fullPath);
        }
    }
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Replace imports
    content = content.replace(/import\s+\{\s*Request,\s*Response\s*\}\s+from\s+'express';/g, "import { FastifyRequest, FastifyReply } from 'fastify';");
    content = content.replace(/import\s+\{\s*Router\s*\}\s+from\s+'express';/g, "import { FastifyPluginAsync } from 'fastify';");
    content = content.replace(/import\s+\{\s*Router,\s*Request,\s*Response\s*\}\s+from\s+'express';/g, "import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';");
    content = content.replace(/import\s+\{\s*Request,\s*Response,\s*NextFunction\s*\}\s+from\s+'express';/g, "import { FastifyRequest, FastifyReply } from 'fastify';");
    content = content.replace(/import\s+express\s+from\s+'express';/g, "");
    content = content.replace(/import\s+express,\s*\{\s*Request,\s*Response\s*\}\s+from\s+'express';/g, "import { FastifyRequest, FastifyReply } from 'fastify';");

    // Replace parameter types
    content = content.replace(/\(req:\s*Request,\s*res:\s*Response\)/g, "(req: FastifyRequest, reply: FastifyReply)");
    content = content.replace(/\(req:\s*AuthRequest,\s*res:\s*Response\)/g, "(req: AuthRequest, reply: FastifyReply)");
    content = content.replace(/\(req:\s*AuthRequest,\s*res:\s*Response,\s*next:\s*NextFunction\)/g, "(req: AuthRequest, reply: FastifyReply)");
    content = content.replace(/\(req:\s*Request,\s*res:\s*Response,\s*next:\s*NextFunction\)/g, "(req: FastifyRequest, reply: FastifyReply)");
    content = content.replace(/\(req:\s*any,\s*res:\s*Response\)/g, "(req: any, reply: FastifyReply)");
    
    // Convert Express Router to Fastify Plugin
    content = content.replace(/const\s+router\s*=\s*Router\(\);/g, "const routes: FastifyPluginAsync = async (fastify, opts) => {");
    
    // Only replace export default router if it exists, and close the block
    if (content.includes('export default router;')) {
        content = content.replace(/export\s+default\s+router;/g, "};\n\nexport default routes;");
    }

    // Convert router.get to fastify.get
    content = content.replace(/\brouter\./g, "fastify.");

    // Convert res. methods to reply.
    // Be very careful to only do this in files where we changed res to reply
    if (original.includes('res: Response') || original.includes('res: FastifyReply') || content.includes('reply: FastifyReply')) {
        content = content.replace(/\bres\./g, "reply.");
    }

    // Convert reply.json to reply.send
    content = content.replace(/\breply\.json\(/g, "reply.send(");

    // Express next() logic in middlewares -> Fastify doesn't use next in async hooks
    // For authMiddleware, we'll rewrite it manually later.

    if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${filePath}`);
    }
}

processDir(path.join(__dirname, 'src'));
console.log('Refactoring script complete.');
