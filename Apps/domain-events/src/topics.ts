export const DOMAIN_TOPICS = {
  reservations: {
    topic: "reservations.events",
    version: "v1",
    description: "Reservation lifecycle commands and projections",
  },
} as const;

export type DomainTopicKey = keyof typeof DOMAIN_TOPICS;

export interface DomainTopicConfig {
  topic: string;
  version: string;
  description?: string;
}

export const resolveDomainTopic = (key: DomainTopicKey): DomainTopicConfig => DOMAIN_TOPICS[key];
