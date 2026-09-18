// Pozo de palabras del tablero. Todas en singular, sin espacios y sin nombres propios,
// para que puedan usarse como pista sin ambigüedad.
export const WORD_POOL = [
  // naturaleza y geografía
  'sol','luna','estrella','playa','montaña','río','bosque','desierto','océano','isla',
  'valle','colina','acantilado','pantano','selva','pradera','glaciar','iceberg','duna','oasis',
  'cráter','meseta','cañón','arrecife','laguna','bahía','golfo','península','continente','archipiélago',
  'manantial','géiser','catarata','marea','corriente','horizonte','sendero','llanura','estepa','tundra',

  // clima y fenómenos
  'fuego','humo','nube','lluvia','nieve','viento','trueno','relámpago','arcoíris','volcán',
  'terremoto','huracán','cascada','cueva','niebla','granizo','tormenta','sequía','inundación','avalancha',
  'eclipse','aurora','rocío','escarcha','brisa','ceniza','lava','chispa','llama','sombra',

  // animales
  'caballo','león','tigre','elefante','jirafa','mono','serpiente','águila','tiburón','ballena',
  'delfín','pulpo','araña','mariposa','abeja','hormiga','pingüino','oso','lobo','zorro',
  'conejo','ardilla','erizo','murciélago','búho','halcón','cuervo','paloma','gallo','pato',
  'cisne','flamenco','tortuga','cocodrilo','lagarto','camaleón','rana','sapo','caracol','gusano',
  'escorpión','cangrejo','langosta','medusa','estrellademar','anguila','salmón','trucha','sardina','atún',
  'camello','dromedario','alpaca','canguro','koala','panda','rinoceronte','hipopótamo','cebra','antílope',
  'gacela','búfalo','bisonte','reno','alce','ciervo','jabalí','nutria','castor','mapache',
  'zorrino','comadreja','hurón','topo','rata','ratón','hámster','loro','tucán','colibrí',
  'avestruz','pavo','ganso','cigüeña','gaviota','pelícano','cóndor','buitre','mosquito','mosca',
  'grillo','saltamontes','libélula','luciérnaga','oruga','termita','pulga','garrapata','polilla','avispa',

  // tecnología
  'robot','computadora','teléfono','internet','satélite','cohete','planeta','galaxia','telescopio','microscopio',
  'pantalla','teclado','batería','antena','cable','circuito','chip','motor','turbina','engranaje',
  'imán','láser','radar','sonar','dron','servidor','algoritmo','contraseña','virus','código',
  'señal','frecuencia','radio','televisor','impresora','escáner','sensor','pila','enchufe','interruptor',
  'holograma','simulador','consola','joystick','auricular','proyector','bombilla','generador','reactor','panel',

  // lugares
  'hospital','escuela','biblioteca','museo','teatro','estadio','aeropuerto','estación','mercado','restaurante',
  'hotel','piscina','jardín','parque','cocina','dormitorio','garaje','sótano','techo','ventana',
  'fábrica','taller','oficina','banco','farmacia','panadería','carnicería','peluquería','comisaría','cuartel',
  'iglesia','templo','monasterio','cementerio','prisión','tribunal','embajada','faro','puerto','muelle',
  'plaza','avenida','callejón','autopista','túnel','peaje','frontera','aduana','refugio','campamento',
  'granja','establo','molino','viñedo','invernadero','observatorio','planetario','acuario','zoológico','circo',

  // casa y objetos
  'puerta','escalera','ascensor','espejo','reloj','calendario','mapa','brújula','linterna','cámara',
  'lápiz','cuaderno','mochila','billetera','llave','candado','cadena','anillo','collar','corona',
  'almohada','colchón','manta','sábana','cortina','alfombra','lámpara','silla','mesa','sillón',
  'armario','cajón','estante','perchero','maceta','florero','jarra','taza','plato','cuchara',
  'tenedor','cuchillo','olla','sartén','horno','heladera','tostadora','licuadora','batidor','colador',
  'escoba','balde','esponja','jabón','toalla','cepillo','peine','tijera','aguja','hilo',
  'botón','cierre','paraguas','abanico','vela','fósforo','encendedor','mecha','basurero','embudo',

  // música y arte
  'guitarra','piano','tambor','violín','trompeta','micrófono','altavoz','libro','revista','periódico',
  'flauta','arpa','saxofón','acordeón','pandereta','maraca','xilófono','partitura','melodía','ritmo',
  'pincel','lienzo','acuarela','escultura','estatua','mural','retrato','paisaje','galería','marco',
  'poema','novela','cuento','guion','escenario','telón','máscara','disfraz','maquillaje','vestuario',

  // herramientas y armas
  'espada','escudo','arco','flecha','lanza','martillo','hacha','sierra','tornillo','clavo',
  'destornillador','pinza','taladro','lima','pala','rastrillo','azada','carretilla','andamio','ladrillo',
  'cemento','pintura','rodillo','nivel','regla','compás','metro','balanza','termómetro','barómetro',
  'cuerda','red','ancla','arpón','mortero','catapulta','ballesta','honda','daga','garrote',

  // transporte
  'barco','submarino','avión','helicóptero','tren','autobús','bicicleta','motocicleta','camión','tractor',
  'globo','paracaídas','canoa','kayak','balsa','yate','velero','ferry','góndola','trineo',
  'patineta','patín','monopatín','teleférico','funicular','tranvía','subte','taxi','ambulancia','carroza',
  'carruaje','vagón','locomotora','cápsula','transbordador','nave','carro','remolque','grúa','excavadora',

  // materiales
  'plata','hierro','madera','piedra','arena','hielo','oro','diamante','moneda','tesoro',
  'bronce','cobre','acero','plomo','estaño','mármol','granito','arcilla','vidrio','cristal',
  'papel','cartón','plástico','goma','cuero','lana','seda','algodón','lino','terciopelo',
  'carbón','petróleo','azufre','mercurio','uranio','sal','yeso','cal','resina','ámbar',
  'perla','rubí','esmeralda','zafiro','topacio','jade','cuarzo','obsidiana','fósil','meteorito',

  // fantasía y misterio
  'pirámide','laberinto','fantasma','vampiro','bruja','mago','hada','gigante','enano','alien',
  'dragón','unicornio','sirena','centauro','minotauro','grifo','fénix','ogro','duende','gnomo',
  'zombi','momia','licántropo','demonio','ángel','oráculo','profecía','maldición','hechizo','poción',
  'amuleto','talismán','reliquia','pergamino','runa','varita','caldero','portal','dimensión','leyenda',
  'castillo','torre','muralla','foso','mazmorra','trono','cetro','gárgola','catedral','claustro',

  // cuerpo
  'cerebro','corazón','esqueleto','calavera','pulmón','hígado','riñón','estómago','columna','costilla',
  'músculo','tendón','vena','arteria','sangre','piel','cabello','barba','ceja','pestaña',
  'hombro','codo','muñeca','rodilla','tobillo','talón','pulgar','uña','lengua','garganta',

  // comida
  'pastel','helado','chocolate','café','queso','pan','huevo','pescado','pollo','regalo',
  'limón','manzana','plátano','uva','sandía','piña','coco','frutilla','cereza','durazno',
  'pera','ciruela','higo','mango','papaya','melón','kiwi','granada','mandarina','pomelo',
  'tomate','papa','cebolla','zanahoria','lechuga','espinaca','brócoli','pepino','pimiento','calabaza',
  'zapallo','choclo','arroz','fideo','harina','azúcar','miel','manteca','aceite','vinagre',
  'pimienta','canela','vainilla','jengibre','ajo','perejil','orégano','albahaca','mostaza','mayonesa',
  'galleta','torta','budín','flan','caramelo','chicle','turrón','mermelada','yogur','leche',
  'sopa','guiso','ensalada','sándwich','empanada','asado','milanesa','hamburguesa','pizza','tarta',

  // plantas
  'cactus','rosa','girasol','árbol','hoja','semilla','raíz','tallo','espina','pétalo',
  'tulipán','orquídea','margarita','lavanda','jazmín','clavel','amapola','helecho','musgo','alga',
  'roble','pino','palmera','sauce','ceibo','olivo','bambú','junco','trigo','maíz',
  'césped','enredadera','tronco','corteza','rama','brote','polen','néctar','bosquecillo','bonsái',

  // deportes y juegos
  'pelota','raqueta','aro','portería','malla','cancha','pista','gimnasio','trofeo','medalla',
  'ajedrez','dado','naipe','ficha','tablero','dominó','ruleta','dardo','billar','bolos',
  'rompecabezas','crucigrama','acertijo','sudoku','trampolín','parapente','esquí','snowboard','surf','buceo',
  'maratón','carrera','salto','lucha','boxeo','esgrima','arquería','escalada','ciclismo','remo',

  // profesiones
  'médico','enfermero','maestro','científico','ingeniero','abogado','juez','policía','bombero','soldado',
  'marinero','piloto','astronauta','chef','panadero','carpintero','herrero','sastre','zapatero','joyero',
  'pintor','escultor','músico','actor','bailarín','escritor','poeta','periodista','fotógrafo','arquitecto',
  'granjero','pastor','pescador','cazador','minero','leñador','jardinero','mecánico','electricista','plomero',
  'detective','espía','pirata','vaquero','caballero','samurái','ninja','gladiador','faraón','emperador',
  'rey','reina','príncipe','princesa','duque','conde','juglar','bufón','monje','ermitaño',

  // ropa
  'camisa','pantalón','vestido','falda','abrigo','bufanda','guante','sombrero','gorra','casco',
  'zapato','bota','sandalia','media','cinturón','corbata','moño','bolsillo','capa','uniforme',
  'delantal','pijama','traje','chaleco','poncho','túnica','armadura','antifaz','guantelete','pulsera',

  // escuela y oficina
  'pizarra','tiza','borrador','carpeta','archivo','sello','sobre','estampilla','tinta','pluma',
  'diccionario','enciclopedia','atlas','agenda','informe','contrato','factura','recibo','planilla','gráfico',
  'examen','tarea','lección','recreo','pupitre','cartuchera','timbre','bandera','globoterráqueo','escritorio',

  // tiempo y medidas
  'segundo','minuto','hora','día','semana','mes','año','década','siglo','milenio',
  'amanecer','atardecer','mediodía','medianoche','invierno','primavera','verano','otoño','solsticio','ciclo',
  'kilómetro','centímetro','gramo','litro','grado','porcentaje','fracción','número','cifra','cero',

  // abstractos y varios
  'silencio','eco','secreto','misterio','enigma','susurro','clave','mensaje','rumor','mentira',
  'verdad','promesa','memoria','sueño','pesadilla','deseo','miedo','valor','suerte','destino',
  'sorpresa','fiesta','carnaval','desfile','ceremonia','boda','aniversario','concurso','subasta','mercadillo',
  'aventura','viaje','expedición','naufragio','rescate','emboscada','fuga','persecución','coartada','testigo',
  'huella','rastro','sospecha','prueba','indicio','trampa','cebo','soborno','escondite','guarida',
  'payaso','marioneta','títere','juguete','trompo','peluche','cometa','burbuja','confeti','serpentina',
  'campana','gong','matraca','silbato','bocina','bombo','trompa','cuerno','címbalo','triángulo',
];
