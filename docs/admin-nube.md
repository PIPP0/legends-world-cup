# Admin de Legends World Cup (como el de Forma)

El admin vive en `/admin` del sitio (impossiblecup.com/admin). Entras con **usuario (correo) y contraseña** o con **Google**, y solo la cuenta listada en la nube
puede ver y cambiar cosas. Mientras no conectes la nube, la web funciona como siempre y el admin muestra «La nube no está conectada».

Qué incluye: **Resumen** (visitas, mundiales, sedes, campeones, satisfacción), **Personas** (cuentas registradas y visitantes),
**Funciones** (interruptores sin republicar), **Encuestas**, **Mundiales** simulados e **Historia** (fase liberada para todos).

## Pasos (una sola vez, unos 10 minutos)
1. **Proyecto de Firebase**: en console.firebase.google.com crea un proyecto NUEVO solo para Legends (plan Spark, gratis).
   No uses el de Forma: así no se mezclan datos de tus clientes.
2. **App web**: Configuración del proyecto → «Agregar app» → Web. Copia el objeto `firebaseConfig` (es público, no es un secreto).
3. **Authentication**: activa los proveedores **Correo/contraseña**, **Google** y **Anónimo**. En Configuración → Acciones del usuario, DESACTIVA «Habilitar creación (registro)». Luego en Usuarios crea tú el usuario administrador con tu correo y una contraseña larga (la escribes solo en Firebase, nunca en un chat). En Configuración → Dominios autorizados agrega `impossiblecup.com` y `pipp0.github.io`.
4. **Firestore**: crea la base de datos en modo producción.
5. **Reglas**: `bash firebase/desplegar-reglas.sh ID_DEL_PROYECTO` (pide iniciar sesión en tu terminal).
6. **Administrador**: en Firestore crea la colección `config`, documento `admin`, con el campo `correos` (tipo array) = `["tu-correo@gmail.com"]`.
7. **Conectar la web**: en GitHub → Settings → Secrets and variables → Actions → Variables, crea `FIREBASE_CONFIG` con el `firebaseConfig`
   en una sola línea como JSON, p. ej. `{"apiKey":"…","authDomain":"…","projectId":"…","appId":"…"}`. Luego Actions → Deploy → Run workflow.
8. Entra a `https://impossiblecup.com/admin` con tu correo y contraseña.

## Qué se guarda y por qué (privacidad)
- **usuarios**: visitante anónimo (sin datos personales) o, si la persona entra con Google, nombre, correo y foto. Visitas, primera y última vez, tipo de equipo.
- **progreso**: hasta qué fase de la historia llegó cada cuenta (para continuar en otro dispositivo).
- **encuestas** y **mundiales**: lo que la persona respondió y qué mundial simuló (sede, mes, clima, campeón). Sin datos de pago.
- Solo el administrador puede leer lo de otras personas; las reglas están en `firebase/firestore.rules`.
- Antes de pedir cuentas a otras personas, publica una política de privacidad (Ley 19.628) y avisa que se guardan estos datos.

## Límites honestos
- Las reglas de seguridad no se pudieron probar con el emulador de Firebase (requiere Java). Revísalas y pruébalas con una cuenta no administradora:
  debe fallar al leer `usuarios`, `encuestas` y `mundiales`.
- El plan gratis de Firebase tiene cuotas diarias; con tráfico alto habría que revisarlas.
