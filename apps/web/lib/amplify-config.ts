import type { ResourcesConfig } from "aws-amplify";

export const amplifyConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env["NEXT_PUBLIC_COGNITO_USER_POOL_ID"] ?? "",
      userPoolClientId: process.env["NEXT_PUBLIC_COGNITO_WEB_CLIENT_ID"] ?? "",
      loginWith: {
        email: true,
      },
    },
  },
};
