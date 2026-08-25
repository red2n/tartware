export type { AcceptedCommand } from "./command-dispatch-service.js";
export { acceptCommand, CommandDispatchError } from "./command-dispatch-service.js";

export {
  listCommandDefinitions,
  shutdownCommandRegistry,
  startCommandRegistry,
} from "./command-registry.js";
