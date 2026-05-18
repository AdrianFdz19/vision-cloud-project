import { RekognitionClient, DetectLabelsCommand } from "@aws-sdk/client-rekognition";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

const rekogClient = new RekognitionClient({});

export const handler = async (event) => {
  // 1. Extraer info del evento de S3
  console.log(event);
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

  // 2. Extraer connectionId del nombre del archivo (antes del punto de la extensión)
  const [stage, idWithExtension] = key.split('#');
  const connectionId = idWithExtension.split('.')[0];

  // 3. Configurar cliente de respuesta para el WebSocket
  // IMPORTANTE: Reemplaza con tu URL de API Gateway (sin el wss://)
  const apiDomain = process.env.API_GATEWAY_DOMAIN;
  const callbackUrl = `https://${apiDomain}/${stage}`;
  const apiGwClient = new ApiGatewayManagementApiClient({ endpoint: callbackUrl });

  // 3. Configuración de Rekognition desde variables de entorno (con respaldos por defecto)
  const maxLabels = parseInt(process.env.REKOG_MAX_LABELS || "10", 10);
  const minConfidence = parseFloat(process.env.REKOG_MIN_CONFIDENCE || "75");

  try {
    // 4. Llamar a Rekognition
    const rekogCommand = new DetectLabelsCommand({
      Image: { S3Object: { Bucket: bucket, Name: key } },
      MaxLabels: maxLabels,
      MinConfidence: minConfidence
    });

    const labelsData = await rekogClient.send(rekogCommand);
    const labels = labelsData.Labels.map(l => l.Name).join(", ");

    // 5. Enviar resultados de vuelta por WebSocket
    const responseMsg = JSON.stringify({
      message: "Análisis completado",
      data: labels
    });

    await apiGwClient.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: responseMsg
    }));

    return { statusCode: 200 };
  } catch (error) {
    console.error("Error:", error);
    return { statusCode: 500 };
  }
};