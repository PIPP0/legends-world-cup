// Datos base proporcionados en el prompt maestro. El orden del once es: portero, y luego
// línea por línea de derecha a izquierda (lado derecho del equipo primero).
// Formato de jugador "Nombre:valoración". Un "?" al final marca un nombre a verificar.
// Las valoraciones son ESTIMACIONES DEL MODELO (jugador a los 27 años), no calificaciones oficiales.

export interface RawTeam {
  id: string
  name: string
  iso: string // código para flagcdn.com
  group: string
  formation: string
  xi: string
}

export const RAW_TEAMS: RawTeam[] = [
  // Grupo A
  { id: 'bra', name: 'Brasil', iso: 'br', group: 'A', formation: '4-2-3-1', xi: 'Gilmar:88|Cafu:91|Lúcio:88|Thiago Silva:90|Roberto Carlos:91|Didi:90|Falcão:89|Garrincha:94|Pelé:99|Ronaldinho:95|Ronaldo Nazário:97' },
  { id: 'eng', name: 'Inglaterra', iso: 'gb-eng', group: 'A', formation: '4-3-3', xi: 'Gordon Banks:92|Gary Neville:84|Bobby Moore:92|Rio Ferdinand:89|Ashley Cole:89|Bobby Charlton:93|Paul Scholes:91|Steven Gerrard:91|Wayne Rooney:91|Harry Kane:92|Stanley Matthews:91' },
  { id: 'rou', name: 'Rumania', iso: 'ro', group: 'A', formation: '4-2-3-1', xi: 'Bogdan Stelea:80|Dan Petrescu:82|Cristian Chivu:83|Gheorghe Popescu:84|Răzvan Raț:78|Dorinel Munteanu:80|László Bölöni:80|Adrian Mutu:83|Gheorghe Hagi:92|Ilie Dumitrescu:82|Adrian Ilie:79' },
  { id: 'jpn', name: 'Japón', iso: 'jp', group: 'A', formation: '4-2-3-1', xi: 'Eiji Kawashima:80|Atsuto Uchida:80|Maya Yoshida:79|Takehiro Tomiyasu:82|Yuto Nagatomo:81|Makoto Hasebe:82|Wataru Endō:82|Takefusa Kubo:84|Shinji Kagawa:85|Keisuke Honda:85|Shinji Okazaki:82' },
  // Grupo B
  { id: 'arg', name: 'Argentina', iso: 'ar', group: 'B', formation: '4-3-1-2', xi: 'Emiliano Martínez:88|Javier Zanetti:90|Daniel Passarella:89|Roberto Ayala:85|Juan Pablo Sorín:82|Javier Mascherano:90|Fernando Redondo:91|Ángel Di María:91|Diego Maradona:98|Lionel Messi:99|Gabriel Batistuta:91' },
  { id: 'cro', name: 'Croacia', iso: 'hr', group: 'B', formation: '4-3-3', xi: 'Danijel Subašić:82|Darijo Srna:84|Dejan Lovren:82|Joško Gvardiol:88|Ivan Strinić:76|Luka Modrić:93|Ivan Rakitić:88|Mateo Kovačić:86|Ivan Perišić:86|Mario Mandžukić:86|Davor Šuker:89' },
  { id: 'mex', name: 'México', iso: 'mx', group: 'B', formation: '4-3-1-2', xi: 'Guillermo Ochoa:84|Paul Aguilar:78|Rafael Márquez:87|Héctor Moreno:78|Carlos Salcido:80|Andrés Guardado:83|Héctor Herrera:82|Pável Pardo:79|Cuauhtémoc Blanco:86|Hugo Sánchez:90|Javier Hernández:84' },
  { id: 'mar', name: 'Marruecos', iso: 'ma', group: 'B', formation: '4-3-3', xi: 'Yassine Bounou:86|Achraf Hakimi:89|Nayef Aguerd:82|Romain Saïss:82|Noussair Mazraoui:82|Sofyan Amrabat:84|Azzedine Ounahi:80|Hakim Ziyech:85|Youssef En-Nesyri:82|Marouane Zemmama:72?|Youssef Mokhtari:70?' },
  // Grupo C
  { id: 'ger', name: 'Alemania', iso: 'de', group: 'C', formation: '4-2-3-1', xi: 'Manuel Neuer:94|Philipp Lahm:91|Franz Beckenbauer:97|Mats Hummels:89|Andreas Brehme:87|Lothar Matthäus:94|Toni Kroos:93|Thomas Müller:91|Michael Ballack:89|Karl-Heinz Rummenigge:92|Gerd Müller:96' },
  { id: 'uru', name: 'Uruguay', iso: 'uy', group: 'C', formation: '4-3-3', xi: 'Fernando Muslera:84|José Nasazzi:87|Diego Godín:89|José María Giménez:85|Martín Cáceres:80|Federico Valverde:90|Obdulio Varela:90|Enzo Francescoli:89|Luis Suárez:93|Edinson Cavani:90|Diego Forlán:89' },
  { id: 'bul', name: 'Bulgaria', iso: 'bg', group: 'C', formation: '4-2-3-1', xi: 'Borislav Mihaylov:80|Radostin Kishishev:74|Trifon Ivanov:82|Nikolay Iliev:72?|Petar Zanev:74|Stiliyan Petrov:80|Krasimir Balakov:85|Hristo Stoichkov:92|Emil Kostadinov:82|Martin Petrov:80|Dimitar Berbatov:88' },
  { id: 'kor', name: 'Corea del Sur', iso: 'kr', group: 'C', formation: '4-2-3-1', xi: 'Lee Woon-jae:80|Lee Young-pyo:80|Hong Myung-bo:82|Kim Min-jae:88|Kim Jin-su:78|Ki Sung-yueng:79|Lee Chung-yong:78|Park Ji-sung:85|Lee Kang-in:84|Son Heung-min:91|Cha Bum-kun:88' },
  // Grupo D
  { id: 'ita', name: 'Italia', iso: 'it', group: 'D', formation: '4-3-1-2', xi: 'Gianluigi Buffon:95|Gianluca Zambrotta:86|Franco Baresi:93|Fabio Cannavaro:92|Paolo Maldini:95|Andrea Pirlo:93|Gennaro Gattuso:86|Marco Tardelli:87|Roberto Baggio:94|Alessandro Del Piero:90|Giuseppe Meazza:92' },
  { id: 'hun', name: 'Hungría', iso: 'hu', group: 'D', formation: '4-2-4', xi: 'Gyula Grosics:88|Jenő Buzánszky:80|Gyula Lóránt:86|Mihály Lantos:80|Károly Sándor:78|József Bozsik:90|Zoltán Czibor:86|Nándor Hidegkuti:90|Sándor Kocsis:93|Ferenc Puskás:97|Flórián Albert:90' },
  { id: 'col', name: 'Colombia', iso: 'co', group: 'D', formation: '4-2-3-1', xi: 'David Ospina:82|Juan Cuadrado:84|Mario Yepes:80|Iván Córdoba:83|Pablo Armero:76|Freddy Guarín:78|Abel Aguilar:74|James Rodríguez:89|Carlos Valderrama:90|Luis Díaz:88|Radamel Falcao:90' },
  { id: 'nga', name: 'Nigeria', iso: 'ng', group: 'D', formation: '4-2-3-1', xi: 'Vincent Enyeama:83|Joseph Yobo:80|Taribo West:78|William Troost-Ekong:78|Taye Taiwo:76|John Obi Mikel:82|Wilfred Ndidi:83|Victor Osimhen:89|Jay-Jay Okocha:89|Ahmed Musa:80|Nwankwo Kanu:86' },
  // Grupo E
  { id: 'fra', name: 'Francia', iso: 'fr', group: 'E', formation: '4-2-3-1', xi: 'Hugo Lloris:88|Lilian Thuram:90|Marcel Desailly:90|Laurent Blanc:88|Patrice Evra:86|Patrick Vieira:91|Claude Makélélé:89|Kylian Mbappé:96|Zinedine Zidane:97|Franck Ribéry:90|Thierry Henry:95' },
  { id: 'bel', name: 'Bélgica', iso: 'be', group: 'E', formation: '4-2-3-1', xi: 'Thibaut Courtois:92|Toby Alderweireld:86|Vincent Kompany:90|Jan Vertonghen:86|Thomas Vermaelen:80|Axel Witsel:86|Youri Tielemans:84|Kevin De Bruyne:94|Eden Hazard:92|Dries Mertens:85|Romelu Lukaku:88' },
  { id: 'per', name: 'Perú', iso: 'pe', group: 'E', formation: '4-3-3', xi: 'Pedro Gallese:78|Luis Advíncula:76|Héctor Chumpitaz:87|Alberto Rodríguez:78|Juan Manuel Vargas:79|Teófilo Cubillas:91|César Cueto:85|José Velásquez:83|Jefferson Farfán:84|Paolo Guerrero:85|Claudio Pizarro:85' },
  { id: 'usa', name: 'Estados Unidos', iso: 'us', group: 'E', formation: '4-2-3-1', xi: 'Tim Howard:85|Sergiño Dest:80|Carlos Bocanegra:78|Oguchi Onyewu:78|Antonee Robinson:80|Michael Bradley:80|Tyler Adams:82|Christian Pulisic:86|Landon Donovan:85|Clint Dempsey:83|Jozy Altidore:77' },
  // Grupo F
  { id: 'esp', name: 'España', iso: 'es', group: 'F', formation: '4-3-3', xi: 'Iker Casillas:93|Dani Carvajal:88|Sergio Ramos:92|Carles Puyol:91|Jordi Alba:88|Sergio Busquets:92|Xavi Hernández:95|Andrés Iniesta:96|David Silva:90|David Villa:91|Fernando Torres:90' },
  { id: 'swe', name: 'Suecia', iso: 'se', group: 'F', formation: '4-4-2', xi: 'Ronnie Hellström:84|Mikael Lustig:74|Olof Mellberg:82|Andreas Granqvist:79|Erik Edman:74|Freddie Ljungberg:84|Nils Liedholm:90|Kim Källström:80|Emil Forsberg:82|Zlatan Ibrahimović:94|Henrik Larsson:90' },
  { id: 'aut', name: 'Austria', iso: 'at', group: 'F', formation: '4-3-1-2', xi: 'Alexander Manninger:78|Stefan Lainer:76|Martin Hiden:74|Aleksandar Dragović:78|David Alaba:90|Julian Baumgartlinger:78|Andreas Herzog:84|Marcel Sabitzer:83|Matthias Sindelar:91|Hans Krankl:86|Toni Polster:83' },
  { id: 'par', name: 'Paraguay', iso: 'py', group: 'F', formation: '4-3-1-2', xi: 'José Luis Chilavert:88|Iván Piris:72|Carlos Gamarra:85|Paulo da Silva:78|Claudio Morel Rodríguez:72|Cristian Riveros:76|Víctor Cáceres:76|Miguel Almirón:80|Julio César Romero:85|Arsenio Erico:90|Roque Santa Cruz:82' },
  // Grupo G
  { id: 'ned', name: 'Países Bajos', iso: 'nl', group: 'G', formation: '4-3-3', xi: 'Edwin van der Sar:91|Wim Suurbier:82|Ronald Koeman:91|Virgil van Dijk:93|Ruud Krol:90|Frank Rijkaard:92|Johan Neeskens:91|Wesley Sneijder:90|Arjen Robben:93|Marco van Basten:96|Johan Cruyff:98' },
  { id: 'den', name: 'Dinamarca', iso: 'dk', group: 'G', formation: '4-3-3', xi: 'Peter Schmeichel:93|Simon Kjær:83|Daniel Agger:82|Andreas Christensen:82|Joakim Mæhle:78|Christian Eriksen:87|Thomas Delaney:80|Michael Laudrup:92|Brian Laudrup:88|Jon Dahl Tomasson:80|Allan Simonsen:88' },
  { id: 'chi', name: 'Chile', iso: 'cl', group: 'G', formation: '4-3-1-2', xi: 'Claudio Bravo:86|Mauricio Isla:82|Gary Medel:82|Elías Figueroa:92|Jean Beausejour:78|Arturo Vidal:90|Charles Aránguiz:86|Jorge Toro:84|Jorge Valdivia:86|Alexis Sánchez:91|Marcelo Salas:91' },
  { id: 'sen', name: 'Senegal', iso: 'sn', group: 'G', formation: '4-3-3', xi: 'Édouard Mendy:88|Youssouf Sabaly:76|Kalidou Koulibaly:90|Abdou Diallo:78|Ismail Jakobs:74|Idrissa Gueye:84|Pape Matar Sarr:78|Cheikhou Kouyaté:78|Ismaïla Sarr:80|El Hadji Diouf:83|Sadio Mané:91' },
  // Grupo H
  { id: 'por', name: 'Portugal', iso: 'pt', group: 'H', formation: '4-3-3', xi: 'Rui Patrício:83|João Cancelo:88|Pepe:88|Rúben Dias:90|Raphaël Guerreiro:82|Deco:89|Bernardo Silva:90|Bruno Fernandes:89|Luís Figo:93|Eusébio:96|Cristiano Ronaldo:97' },
  { id: 'pol', name: 'Polonia', iso: 'pl', group: 'H', formation: '4-3-3', xi: 'Wojciech Szczęsny:87|Łukasz Piszczek:80|Kamil Glik:83|Jan Bednarek:77|Jakub Wawrzyniak:70|Grzegorz Krychowiak:80|Piotr Zieliński:85|Zbigniew Boniek:90|Jakub Błaszczykowski:83|Robert Lewandowski:95|Grzegorz Lato:86' },
  { id: 'cmr', name: 'Camerún', iso: 'cm', group: 'H', formation: '4-3-3', xi: 'André Onana:85|Geremi:80|Nicolas Nkoulou:78|Rigobert Song:82|Benoît Assou-Ekotto:76|Alex Song:82|André-Frank Zambo Anguissa:84|Stéphane Mbia:78|Samuel Eto\'o:92|Roger Milla:87|Vincent Aboubakar:82' },
  { id: 'tur', name: 'Turquía', iso: 'tr', group: 'H', formation: '4-2-3-1', xi: 'Rüştü Reçber:86|Hamit Altıntop:76|Çağlar Söyüncü:82|Alpay Özalan:80|Hakan Balta:74|Nuri Şahin:82|Emre Belözoğlu:82|Arda Turan:84|Hakan Çalhanoğlu:87|Tuncay Şanlı:80|Hakan Şükür:87' },
]

// Resultados oficiales de la fase de grupos (historia original). Orden: fecha 1 (2 partidos), fecha 2 (2), fecha 3 (2).
export const RAW_RESULTS: Record<string, string[]> = {
  A: ['bra 2-1 eng', 'rou 1-1 jpn', 'bra 3-0 rou', 'eng 2-0 jpn', 'bra 2-1 jpn', 'eng 2-1 rou'],
  B: ['arg 2-1 cro', 'mex 1-1 mar', 'arg 2-0 mex', 'cro 1-0 mar', 'arg 1-1 mar', 'cro 2-1 mex'],
  C: ['ger 2-2 uru', 'bul 2-1 kor', 'ger 3-1 bul', 'uru 2-0 kor', 'ger 2-0 kor', 'uru 2-1 bul'],
  D: ['ita 1-2 hun', 'col 2-1 nga', 'ita 2-0 col', 'hun 3-1 nga', 'ita 2-0 nga', 'hun 2-2 col'],
  E: ['fra 2-1 bel', 'per 2-1 usa', 'fra 2-0 per', 'bel 3-1 usa', 'fra 3-0 usa', 'bel 1-1 per'],
  F: ['esp 2-1 swe', 'aut 1-1 par', 'esp 2-0 aut', 'swe 2-1 par', 'esp 2-0 par', 'swe 1-1 aut'],
  G: ['ned 2-1 den', 'chi 2-1 sen', 'ned 2-2 chi', 'den 2-0 sen', 'ned 3-1 sen', 'chi 1-1 den'],
  H: ['por 2-1 pol', 'cmr 2-1 tur', 'por 2-2 cmr', 'pol 2-0 tur', 'por 3-1 tur', 'pol 1-1 cmr'],
}

// Clasificados declarados en el material original (primero, segundo).
export const DECLARED_QUALIFIERS: Record<string, [string, string]> = {
  A: ['bra', 'eng'], B: ['arg', 'cro'], C: ['ger', 'uru'], D: ['hun', 'ita'],
  E: ['fra', 'bel'], F: ['esp', 'swe'], G: ['ned', 'chi'], H: ['por', 'cmr'],
}

// Octavos definidos en el material original (sin resultados).
export const DECLARED_R16: [string, string][] = [
  ['bra', 'cro'], ['ger', 'ita'], ['fra', 'swe'], ['ned', 'cmr'],
  ['arg', 'eng'], ['hun', 'uru'], ['esp', 'bel'], ['por', 'chi'],
]

// Goleadores declarados por la simulación original (sin desglose por partido).
export const DECLARED_SCORERS: { name: string; goals: number; complete: boolean }[] = [
  { name: 'Ronaldo Nazário', goals: 3, complete: true },
  { name: 'Luis Suárez', goals: 3, complete: true },
  { name: 'Ferenc Puskás', goals: 3, complete: true },
  { name: 'Kylian Mbappé', goals: 3, complete: true },
  { name: 'Marco van Basten', goals: 3, complete: true },
  { name: 'Eusébio', goals: 3, complete: true },
  ...['Lionel Messi', 'Pelé', 'Cristiano Ronaldo', 'Alexis Sánchez', 'Iván Zamorano', 'Johan Cruyff', 'Thierry Henry',
    'David Villa', 'Gerd Müller', 'Harry Kane', 'Robert Lewandowski', "Samuel Eto'o", 'Roger Milla']
    .map((name) => ({ name, goals: 2, complete: false })),
]

// Asistencias: estimación provisional (la simulación original no registró asistentes).
export const ESTIMATED_ASSISTS: { name: string; assists: number }[] = [
  { name: 'Diego Maradona', assists: 3 }, { name: 'Ronaldinho', assists: 3 }, { name: 'Zinedine Zidane', assists: 3 },
  { name: 'Xavi Hernández', assists: 3 }, { name: 'Lionel Messi', assists: 2 }, { name: 'Pelé', assists: 2 },
  { name: 'Kevin De Bruyne', assists: 2 }, { name: 'Luka Modrić', assists: 2 }, { name: 'Johan Cruyff', assists: 2 },
  { name: 'Luís Figo', assists: 2 }, { name: 'Jorge Valdivia', assists: 2 }, { name: 'Andrés Iniesta', assists: 2 },
  { name: 'Ferenc Puskás', assists: 2 },
]

// Textos de crónica entregados por el autor del proyecto (se usan tal cual).
export const AUTHOR_CHRONICLES: Record<string, string> = {
  'bra-eng': 'El torneo comienza con un enfrentamiento que parece una final anticipada. Pelé dirige el ataque brasileño, Ronaldo Nazário amenaza el área y Bobby Moore organiza la resistencia inglesa. Inglaterra golpea con Kane, pero Brasil termina imponiéndose por 2–1.',
  'ita-hun': 'Una de las primeras grandes sorpresas del campeonato. La defensa italiana, considerada una de las mejores de todos los tiempos, no consigue detener el talento de Ferenc Puskás y Sándor Kocsis. Hungría vence 2–1 y demuestra que su generación dorada puede competir contra cualquier potencia.',
  'ned-chi': 'Dos escuelas futbolísticas se encuentran. Cruyff dirige el juego neerlandés, pero Chile responde con la intensidad de Vidal, la creatividad de Valdivia y el desequilibrio de Alexis Sánchez. El empate 2–2 mantiene intactas las posibilidades chilenas.',
}

// Nombres de lineups que conviene verificar (auditoría de datos).
export const WIKI_TITLE_HINTS: Record<string, string> = {
  Pepe: 'Pepe (footballer, born 1983)', Gilmar: 'Gilmar (footballer, born 1930)', Didi: 'Didi (footballer)',
  'Ronaldo Nazário': 'Ronaldo (Brazilian footballer)', Falcão: 'Paulo Roberto Falcão', Lúcio: 'Lúcio (footballer, born 1978)',
  Geremi: 'Geremi Njitap', Deco: 'Deco', Xavi: 'Xavi',
}
