// Permite que las pruebas en Node importen módulos de src/ tal como los ve el
// bundler: alias "@/..." y rutas relativas sin extensión (.ts/.tsx).
//   node --import ./scripts/register-ts.mjs scripts/<prueba>.test.mjs
import { register } from "node:module";
register("./ts-resolve-hooks.mjs", import.meta.url);
