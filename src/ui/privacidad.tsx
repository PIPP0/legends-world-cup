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
        <p>{tr('Tus equipos y preferencias se guardan en tu navegador (almacenamiento local). Puedes borrarlos limpiando los datos del sitio.')}</p>
      </div>
    </Section>
  )
}
