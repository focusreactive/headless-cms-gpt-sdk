import { SanityClient } from "sanity";

let sanityClient: SanityClient | null = null;

export const initSanityClient = (client: SanityClient) => {
  sanityClient = client;
};

export const getSanityClient = () => {
  return sanityClient;
};
