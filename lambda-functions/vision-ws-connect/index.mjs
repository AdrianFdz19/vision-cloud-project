import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const token = event.queryStringParameters?.token;

  if (!token) {
    return { statusCode: 403, body: "No token provided" };
  }

  try {
    const command = new PutCommand({
      TableName: process.env.TABLE_NAME,
      Item: {
        connectionId: connectionId,
        userId: "test-user-id",
        connectedAt: Date.now()
      }
    });

    await docClient.send(command);
    
    // Solo retornamos 200. El túnel se abre y punto.
    return { statusCode: 200, body: "Connected" };
  } catch (error) {
    console.error("Error en OnConnect:", error);
    return { statusCode: 500, body: "Failed to connect" };
  }
};