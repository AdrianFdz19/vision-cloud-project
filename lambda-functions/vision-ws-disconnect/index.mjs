import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  // Extraemos el ID que AWS nos da al cerrar el socket
  const connectionId = event.requestContext.connectionId;
  const TABLE_NAME = process.env.TABLE_NAME;

  const command = new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      connectionId: connectionId // Partition Key de tu tabla
    }
  });

  try {
    await docClient.send(command);
    console.log(`Disconnected and removed: ${connectionId}`);
    return { statusCode: 200, body: "Disconnected." };
  } catch (err) {
    console.error("Error on disconnect:", err);
    return { statusCode: 500, body: "Failed to disconnect." };
  }
};