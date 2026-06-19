import type { ResourcesConfig } from "aws-amplify";

export const amplifyConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: "eu-west-2_CtM4oVKs1",
      userPoolClientId: "76b9t0bi5fa5k61edmvm7s4213",
      loginWith: {
        email: true,
      },
    },
  },
};
