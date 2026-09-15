/**
 * Protección contra promesas que nunca se resuelven (ej. una petición de red
 * a Supabase que se queda colgada). NO oculta el problema: si el tiempo se
 * cumple, la promesa se RECHAZA con `TimeoutError` — el llamador decide qué
 * hacer (mostrar un error visible, reintentar, o degradar a un valor por
 * defecto conocido). Nunca se usa para simular éxito ni para esconder un
 * estado de carga.
 */
export class TimeoutError extends Error {
  constructor(message = "La operación tardó demasiado en responder.") {
    super(message);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
