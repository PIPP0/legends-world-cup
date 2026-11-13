import { tr } from '../i18n'
import { Section } from './common'

export function Privacidad() {
  return (
    <Section title={tr('Privacidad')} sub={tr('Qué datos guardamos y para qué')}>
      <div className="prose" style={{ display: 'grid', gap: 12, maxWidth: 760 }}>
        <p>{tr('Esta web no te pide nombre ni correo para usarla. Al entrar, tu navegador recibe una cuenta anónima (un identificador al azar) para guardar tus votos y tu progreso.')}</p>
        <p>{tr('Con esa cuenta guardamos datos técnicos del navegador: país aproximado (por zona horaria, no por IP), sistema, navegador, tamaño de pantalla, idioma, desde dónde llegaste, si hubo interacción y cuánto tiempo estuviste. Sirven para mejorar la web y distinguir personas de robots.')}</p>
        <p>{tr('No guardamos tu dirección IP, no vendemos datos ni usamos publicidad de terceros.')}</p>
        <p>{tr('Si entras con Google, guardamos además tu nombre, correo y foto, solo para identificar tu voto o tu equipo.')}</p>
        <p>{tr('Si entras con Google, tu equipo del Duelo y tus estadísticas también se guardan en tu cuenta para que te sigan a todos tus dispositivos. Tus demás preferencias se guardan en tu navegador y puedes borrarlas limpiando los datos del sitio.')}</p>
        <p>{tr('Si juegas duelos, tu nombre público (tu nombre y la inicial de tu apellido), tu país aproximado y tus resultados aparecen en el ranking, que es público. Puedes cambiar ese nombre una vez.')}</p>
        <p>{tr('Si respondes una encuesta, tu respuesta y tu comentario quedan asociados a tu cuenta, y el administrador de la web puede ver quién la envió.')}</p>
      </div>
    </Section>
  )
}
