export type { AcceptedCommand } from "./command-dispatch-service.js";
export {
	acceptCommand,
	CommandDispatchError,
	markCommandDelivered,
	markCommandFailed,
} from "./command-dispatch-service.js";

export {
	shutdownCommandRegistry,
	startCommandRegistry,
} from "./command-registry.js";
