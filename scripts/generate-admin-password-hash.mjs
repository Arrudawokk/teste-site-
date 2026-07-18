import { hash } from "bcryptjs";

async function readPassword() {
  if (!process.stdin.isTTY) {
    let value = "";
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) value += chunk;
    return value.trimEnd();
  }
  process.stdout.write("Senha administrativa (mínimo 12 caracteres): ");
  process.stdin.setRawMode(true);
  process.stdin.setEncoding("utf8");
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      resolve(value);
    };
    process.stdin.on("data", (chunk) => {
      if (chunk === "\u0003") {
        process.stdin.setRawMode(false);
        reject(new Error("Operação cancelada."));
        return;
      }
      if (chunk === "\r" || chunk === "\n") { finish(); return; }
      if (chunk === "\u007f" || chunk === "\b") {
        if (value) { value = value.slice(0, -1); process.stdout.write("\b \b"); }
        return;
      }
      value += chunk;
      process.stdout.write("*".repeat([...chunk].length));
    });
  });
}

try {
  const password = await readPassword();
  if (password.length < 12 || password.length > 256) throw new Error("A senha deve ter entre 12 e 256 caracteres.");
  const digest = await hash(password, 12);
  process.stdout.write(`ADMIN_PASSWORD_HASH=${digest}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Não foi possível gerar o hash."}\n`);
  process.exitCode = 1;
}
