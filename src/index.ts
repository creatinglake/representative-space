import app from "./app.js";
import { startPoller } from "./services/deliberationPoller.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);

app.listen(PORT, () => {
  console.log(
    `\n🏛️  Representative Space running at http://localhost:${PORT}`,
  );
  console.log(
    `   Discovery: http://localhost:${PORT}/.well-known/civic.json`,
  );
  console.log(`   Events:    http://localhost:${PORT}/events`);
  console.log(`   Health:    http://localhost:${PORT}/health\n`);

  startPoller();
});
