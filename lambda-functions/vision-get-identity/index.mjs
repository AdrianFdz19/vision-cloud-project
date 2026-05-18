import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

export const handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const domain = event.requestContext.domainName;
  const stage = event.requestContext.stage;

  // El cliente se instancia igual usando el endpoint dinámico
  const apiGwClient = new ApiGatewayManagementApiClient({
    endpoint: `https://${domain}/${stage}`
  });

  try {
    // Usamos el patrón estándar de comandos del SDK v3
    await apiGwClient.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify({
        type: "INIT",
        connectionId: connectionId
      })
    }));

    return { statusCode: 200, body: "Identity sent." };
  } catch (error) {
    console.error("Error enviando identidad:", error);
    return { statusCode: 500 };
  }
};