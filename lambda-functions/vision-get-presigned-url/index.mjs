import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({});

export const handler = async (event) => {
    // El frontend enviará el connectionId como un query parameter o en el body
    const env = event.queryStringParameters?.env || "dev";
    const connectionId = event.queryStringParameters?.connectionId;

    const BUCKET_NAME = process.env.S3_BUCKET_NAME;

    if (!BUCKET_NAME) {
        console.error("Falta la variable de entorno S3_BUCKET_NAME");
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Internal server configuration error" })
        };
    }

    if (!connectionId) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "connectionId is required" })
        };
    }

    const key = `${env}#${connectionId}.jpg`; // Forzamos que el nombre sea el ID

    try {
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: "image/jpeg" // Importante para que S3 lo maneje bien
        });

        // Generamos la URL válida por 5 minutos (300 segundos)
        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*", // Importante para tu Next.js
                "Access-Control-Allow-Methods": "GET"
            },
            body: JSON.stringify({ uploadUrl: presignedUrl, key: key })
        };
    } catch (error) {
        console.error(error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};