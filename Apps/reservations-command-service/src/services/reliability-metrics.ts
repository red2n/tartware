export type ReliabilityHttpCounters = {
  incoming: number;
  unauthorized: number;
  unknown: number;
};

const counterState: ReliabilityHttpCounters = {
  incoming: 0,
  unauthorized: 0,
  unknown: 0,
};

export const recordReliabilityIngress = (): void => {
  counterState.incoming += 1;
};

export const recordReliabilityOutcome = (statusCode: number): void => {
  if (statusCode === 401 || statusCode === 403) {
    counterState.unauthorized += 1;
    return;
  }
  if (statusCode >= 500) {
    counterState.unknown += 1;
  }
};

export const getReliabilityHttpCounters = (): ReliabilityHttpCounters => ({
  incoming: counterState.incoming,
  unauthorized: counterState.unauthorized,
  unknown: counterState.unknown,
});
