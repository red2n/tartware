import "../repositories/__tests__/checkpoint-repository.test.js";
import "../repositories/__tests__/consumer-offset-repository.test.js";

process.on("beforeExit", (code) => {
  if (code === 0) {
    console.log("Repository tests completed successfully");
  }
});
