--
-- PostgreSQL database dump
--

-- Dumped from database version 14.18 (Ubuntu 14.18-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 16.9 (Ubuntu 16.9-1.pgdg22.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: categorias; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categorias (
    id integer NOT NULL,
    nombre character varying NOT NULL,
    comercio_id integer
);


ALTER TABLE public.categorias OWNER TO postgres;

--
-- Name: categorias_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categorias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categorias_id_seq OWNER TO postgres;

--
-- Name: categorias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categorias_id_seq OWNED BY public.categorias.id;


--
-- Name: clientes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clientes (
    id integer NOT NULL,
    nombre character varying(150) NOT NULL,
    apellido character varying(150) NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    telefono character varying(20) NOT NULL,
    telefono_2 character varying(20),
    direccion character varying(255) NOT NULL,
    estado character varying(20) NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    fecha_actualizacion timestamp without time zone DEFAULT now() NOT NULL,
    rol_id integer NOT NULL
);


ALTER TABLE public.clientes OWNER TO postgres;

--
-- Name: clientes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.clientes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clientes_id_seq OWNER TO postgres;

--
-- Name: clientes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.clientes_id_seq OWNED BY public.clientes.id;


--
-- Name: comercios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comercios (
    id integer NOT NULL,
    nombre_comercial character varying(150) NOT NULL,
    razon_social character varying(200) NOT NULL,
    nit character varying(20) NOT NULL,
    descripcion character varying(255) NOT NULL,
    responsable character varying(100) NOT NULL,
    email_contacto character varying(100) NOT NULL,
    telefono character varying(15) NOT NULL,
    telefono_secundario character varying(15) NOT NULL,
    direccion character varying(255) NOT NULL,
    logo_url character varying,
    estado character varying DEFAULT 'activo'::character varying NOT NULL,
    activar_numero integer DEFAULT 0 NOT NULL,
    horarios jsonb DEFAULT '{"horarios": [{"dia": "lunes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}'::jsonb,
    estado_comercio boolean DEFAULT true NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    fecha_actualizacion timestamp without time zone DEFAULT now() NOT NULL,
    servicio_id integer
);


ALTER TABLE public.comercios OWNER TO postgres;

--
-- Name: comercios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.comercios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comercios_id_seq OWNER TO postgres;

--
-- Name: comercios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.comercios_id_seq OWNED BY public.comercios.id;


--
-- Name: imagenes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.imagenes (
    id integer NOT NULL,
    nombre character varying NOT NULL,
    ruta character varying NOT NULL,
    "creadoEn" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.imagenes OWNER TO postgres;

--
-- Name: imagenes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.imagenes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.imagenes_id_seq OWNER TO postgres;

--
-- Name: imagenes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.imagenes_id_seq OWNED BY public.imagenes.id;


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


ALTER TABLE public.migrations OWNER TO postgres;

--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.migrations_id_seq OWNER TO postgres;

--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: productos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.productos (
    id integer NOT NULL,
    nombre character varying NOT NULL,
    descripcion character varying,
    precio numeric NOT NULL,
    precio_descuento numeric,
    estado character varying DEFAULT 'activo'::character varying NOT NULL,
    estado_descuento character varying DEFAULT 'inactivo'::character varying NOT NULL,
    unidad character varying,
    imagen_url character varying,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    fecha_actualizacion timestamp without time zone DEFAULT now() NOT NULL,
    "categoriaId" integer,
    "comercioId" integer
);


ALTER TABLE public.productos OWNER TO postgres;

--
-- Name: productos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.productos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.productos_id_seq OWNER TO postgres;

--
-- Name: productos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.productos_id_seq OWNED BY public.productos.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    nombre character varying NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    fecha_actualizacion timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: servicios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.servicios (
    id integer NOT NULL,
    nombre character varying(150) NOT NULL,
    estado character varying DEFAULT 'activo'::character varying NOT NULL,
    icon character varying(50),
    color character varying(20),
    orden integer,
    foto character varying(255),
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    fecha_actualizacion timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.servicios OWNER TO postgres;

--
-- Name: servicios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.servicios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.servicios_id_seq OWNER TO postgres;

--
-- Name: servicios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.servicios_id_seq OWNED BY public.servicios.id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    email character varying NOT NULL,
    password character varying NOT NULL,
    rol character varying DEFAULT 'usuario'::character varying NOT NULL,
    estado character varying DEFAULT 'activo'::character varying NOT NULL,
    telefono character varying(15),
    direccion character varying(255),
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    fecha_actualizacion timestamp without time zone DEFAULT now() NOT NULL,
    comercio_id integer
);


ALTER TABLE public.usuarios OWNER TO postgres;

--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuarios_id_seq OWNER TO postgres;

--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: categorias id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias ALTER COLUMN id SET DEFAULT nextval('public.categorias_id_seq'::regclass);


--
-- Name: clientes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes ALTER COLUMN id SET DEFAULT nextval('public.clientes_id_seq'::regclass);


--
-- Name: comercios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comercios ALTER COLUMN id SET DEFAULT nextval('public.comercios_id_seq'::regclass);


--
-- Name: imagenes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.imagenes ALTER COLUMN id SET DEFAULT nextval('public.imagenes_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: productos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.productos ALTER COLUMN id SET DEFAULT nextval('public.productos_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: servicios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servicios ALTER COLUMN id SET DEFAULT nextval('public.servicios_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Data for Name: categorias; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categorias (id, nombre, comercio_id) FROM stdin;
1	Hamburguesa 	1
2	Pizza	1
3	Gaseosa 	1
4	Lasaña	1
5	Perros	1
6	Panseroti 	1
7	🍔HAMBURGUESAS 	2
8	🍖PICADAS 	2
9	PATAKOLOS	2
10	PACMAN	2
12	Hamburguesas 	4
13	Hot Dogs	4
14	Papitas	4
15	Sándwiches 	4
16	Bebidas	4
17	Picadas	5
18	Hamburguesas	5
19	Desgranados 	5
20	Perros	5
21	Carnes 	5
22	Salchipapas 	5
23	Adicionales 	5
24	Bebidas 	5
25	Pizza	6
26	Sándwich 	6
28	Choripan	6
29	Choripapa artisan	6
30	Costillas artisan Barbecue	6
27	Hamburguesa artisan	6
31	Bebidas personales 	6
32	Postres	6
33	Pizza	7
34	Hamburguesas	7
36	Mazorcada	7
37	Arepas	7
38	Patacones	7
39	Sandwich	7
40	Perros calientes	7
41	Salchipapas	7
42	Pechuga a la parrilla	7
43	Pechuga gratinada	7
44	Pescados	8
46	Pollo 	10
47	Carnes 	10
48	Bebidas 	10
49	Arroz chino	11
50	Porciones	11
51	Pollo	11
52	Platos especiales 	11
53	Bebidas 	11
54	Arrozes 	11
55	SANCOCHO DE GALLINA	11
56	TORTILLA 🫓	11
57	ESPAGUETIS	11
58	LAIS COLLYS	11
59	SHOP SUEY	11
60	POLLO CHINO	11
61	ENCEBOLLADO DE CAMARON	11
62	LUMPIAS	11
63	Combo alitas 	12
64	Arroz chino	12
65	Pollo Broaster 	12
66	Hamburguesas	13
67	Hot dog 	13
68	Sándwich 	13
69	Sándwich 	15
70	Hamburguesas	15
71	Bebidas	15
72	Sándwich gourmet	15
73	Perros calientes	15
74	Chorizos	15
75	Salchipapa	15
76	Perros Calientes 🌭	2
77	Choripapas 	2
78	Sándwiches 	2
79	Burritos 🌯 	2
80	Combos Junior	2
81	Bebidas🧋	2
82	Especiales 	2
83	Entradas	2
84	Adicionales	2
85	Pañales cuidado bb	16
86	Leche	16
87	Analgésicos 	16
88	Antigripales	16
89	Anticonceptivos 	16
90	Antisépticos	16
91	HIDRATANTES	16
92	AREPAS	17
93	CHORIZOS 	17
94	BEBIDAS 	17
95	SANCOCHO DE GALLINA CRIOLLA 	17
96	CARNE AL BARRIL	17
97	BANDEJA PAISA	17
98	HAMBURGUESAS	18
99	PERROS CALIENTES	18
100	SALCHIPAPAS	18
101	BROCHETAS	18
102	ADICIONALES	18
103	BEBIDAS	18
104	CHORI-PAPA	18
105	CHORI-PERRO	18
106	ZUISO-PERRO	18
107	CHORIZOS	18
108	SUIZO	18
109	ZUISO	19
110	CHORIZO BRISA	19
111	ALITA	19
112	HAMBURGUESA 	19
113	PERROS	19
115	Hamburguesas	20
116	Perros calientes	20
117	Salchipapas	20
118	Bebidas 	20
119	Mazorcadas	20
120	Alitas bbq	20
114	Pizza 	20
121	pañales 	22
122	Leches	22
123	Vitaminas	22
124	Bebidas 	22
125	LUMPIAS	23
126	ARROS CHINO	23
127	ARROZ ESPECIAL	23
128	ARROZ CON CAMARONES	23
129	POLLO	23
130	PLATOS A LA CARTA	23
131	SHOP-SUEY	23
132	ESPAGUETIS	23
133	CAZUELA DE CAMARONES	23
134	BEBIDAS 	23
135	PANADERIA ARTESANAL	9
137	PLATOS FUERTES 	9
138	BEBIDAS CALIENTES 	9
139	ENTRADAS	24
140	DESAYUNOS	24
141	MENU EJECUTIVO 	24
142	PESCADOS	24
143	PORCIONES A LA LLANERA	24
144	ADICIONALES	24
145	PASTAS	24
146	HAMBURGUESAS	24
147	PLATOS AL CARBÓN 	24
148	JUGOS NATURALES 	24
149	BEBIDAS FRIAS 	24
150	BEBIDAS CALIENTES 	24
151	VINOS	24
152	OTRAS BEBIDAS	24
153	WHISKY	24
136	SANDWICHES	9
154	BEBIDAS FRIAS	9
155	Res	8
156	Cerdo	8
157	Pollo	8
158	Entradas	8
159	ENSALADA DE FRUTAS 	25
160	COPAS DE HELADO 	25
161	COMIDAS RÁPIDAS 	25
162	BEBIDAS 	25
163	MALTEADAS 	25
164	SÁNDWICH 	25
165	ENSALADAS	26
166	MENU INFANTIL 	26
167	HELADOS 	26
168	WAFFLES	26
169	COMIDAS RÁPIDAS 	26
170	CARNES 	26
171	BEBIDAS 	26
172	MALTEADAS 	26
173	FUNCIONALES 	27
175	BOWLS	27
177	ENSALADA DE FRUTAS 	27
178	PARFAITS	27
180	SMOOTHIES	27
181	BAJO CERO	27
183	LIMONADAS	27
184	AREPAS 	28
185	SALCHIPAPA 	28
186	BEBIDAS 	28
187	VARIOS	28
188	MAZORCA 	28
189	HAMBURGUESA 	28
190	POLLO ENTERO	29
191	BEBIDAS	29
192	PERSONALES 	29
193	FAMILIARES 	29
194	ARROZ 🌾	29
195	PERSONAL 	29
196	PICADAS 	30
197	Hamburguesas	30
198	BEBIDAS 	30
199	ADICIONALES	30
200	COSTILLAS 	30
201	SALCHIPAPA 	30
202	PLATOS	30
203	CHORISOS 	31
204	HAMBURGUESAS 	31
205	BEBIDAS 	31
206	PICADAS 	31
207	CARNES 	31
208	ARROZ CHINO	32
209	ARROZ PAISA	32
210	CHOP SUEY	32
211	ESPAGUETIS	32
212	TORTILLA 	32
213	SUSHI	32
214	ADICIONALES 	32
215	BEBIDAS 	32
217	ARROZ PAISA 	33
218	ARROZ MIXTO 	33
219	ARROZ RANCHERO 	33
220	ARROZ CHINO 	33
221	ARROZ DEL CAMPO 	33
222	ARROZ VEGETARIANO	33
223	ARROZ CON CAMARÓNES	33
224	ARROZ CON TODAS LAS CARNES	33
174	PROTEÍNAS	27
176	TODAS LAS REGIONES 	27
182	MERIENDAS 	27
179	EXÓTICAS	27
229	Pollo BROASTER 	34
230	POLLO 	35
231	PLATOS A LA CARTA 	36
232	BEBIDAS 	36
233	POLLO	37
234	PLATOS ESPECIALES 	38
235	BEBIDAS 	38
236	CÓCTELES	38
237	Salchipapas 	39
238	Bebibas	39
239	Conofrecer	40
290	ESTIMULANTES	46
291	MULTIORGASMO 	46
225	EJECUTIVO 1 	33
226	EJECUTIVO 2 	33
227	ADICIONALES	33
228	BEBIDAS	33
240	Arepas 	41
241	Granizados 	41
242	Frappé 	41
243	TOSTADAS FRANCESAS 	42
244	COCOTTE	42
245	BOWLS	42
246	MIGRADOS	42
247	SODAS	42
248	MINOSAS	42
249	SMOOTHIES	42
250	BEBIDAS CALIENTES 	42
251	ENTRADAS	42
252	CROISSANT SALADOS	42
253	CROISSANT DULCES 	42
254	PANCAKES	42
255	SAN WHAFLES 	42
256	HUEVOS	42
257	SANDWICHES	42
258	FUNDUE	42
259	HAMBURGUESA 	43
260	PIZZA 	43
261	BEBIDAS 	43
262	SÁNDWICH 	43
263	HAMBURGUESA 	44
264	BEBIDAS 	44
265	PERROS 	44
266	PICADAS 	44
267	ENVUETAS 	44
268	COMBOS HAMBURGUESAS	44
269	ADICIONALES 	44
270	BEBIDAS 	7
271	POLLO 	35
272	CERDO	35
273	RES 	35
274	PESCADO	35
275	ARROZ 	35
276	CALDOS 	35
277	DELICIAS 	35
278	FIAMBRES 	35
279	PORCIÓNES 	35
280	BEBIDAS 	35
281	Asado huilense 	45
282	Juan valerios 	45
283	BEBIDAS 	45
287	LENCERIA	46
288	FETISH	46
292	FEROMONAS	46
286	RETARDANTES 	46
289	POTENCIALIZADORES 	46
293	DILDOS	46
294	JUGUETE PARA HOMBRE	46
285	VIBRADORES 	46
295	ESTRECHANTES 	46
296	PRESERVATIVOS 	46
297	PLUGS 4N4LES	46
298	ACEITES PARA MASAJES	46
299	ARNÉS 	46
300	VESTIDO DE BAÑO	46
301	JUEGOS EROTICOS	46
302	PESCADO 	47
303	SALSAMENTARIA 	47
304	Comida Rápida	48
305	Broaster	48
306	Almuerzo 	48
307	Adiciones	48
309	BEVERLY HILLS (MUJER)	49
310	PERRY ELLIS. (MUJER)	49
311	ESCADA (MUJER)	49
314	PARIS HILTON. (MUJER)	49
313	Buberry. (MUJER)	49
312	KIM KARDASHAN. (MUJER)	49
308	 CAROLINA HERRERA (Mujer)	49
315	VICTORIA SECRET. (MUJER)	49
316	YAMBAL (Mujer)	49
317	YAMBAL.  (HOMBRE)	49
318	CALVIN KLEIN. (HOMBRE)	49
319	ARIANA GRANDE. (MUJER)	49
320	PACO RABAN (MUJER)	49
321	D&D. (MUJER)	49
322	LAMCOME.   (MUJER)	49
323	ISSIEY MIYAKE (MUJER)	49
324	ISSEY MIYAKE.  (HOMBRE)	49
325	BVLGARY.  (MUJER)	49
326	SELENA GOMEZ	49
327	SOFIA VERGARA	49
328	ARIANA GRANDE (MUJER)	49
329	MOCHINO (MUJER)	49
330	VIVA LA JUICY	49
331	ARABES UNISEX	49
332	ARABES (MUJER)	49
333	ARABES (HOMBRE)	49
334	VERSACE (MUJER)	49
335	VERSACE (HOMBRE)	49
336	BUBERRY  (MUJER)	49
337	POLLO	50
338	HAMBURGUESAS	50
339	VOLUMINIZANTE	46
284	LUBRICANTES INTIMO	46
340	LUBRICANTE ANAL	46
\.


--
-- Data for Name: clientes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.clientes (id, nombre, apellido, email, password, telefono, telefono_2, direccion, estado, fecha_creacion, fecha_actualizacion, rol_id) FROM stdin;
\.


--
-- Data for Name: comercios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.comercios (id, nombre_comercial, razon_social, nit, descripcion, responsable, email_contacto, telefono, telefono_secundario, direccion, logo_url, estado, activar_numero, horarios, estado_comercio, fecha_creacion, fecha_actualizacion, servicio_id) FROM stdin;
1	PEKAS PIZZA	Pekas pizza sas	83219176	Disfruta de la mejor pizza sin salir de casa	JHON 	pekaspizza777@gmail.com	3138559008	3134089563	Carrera 1 # 14-07 andes 	1749504478370.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "10:00 PM", "apertura": "05:00 PM"}, {"dia": "martes", "cierre": "10:00 PM", "apertura": "05:00 PM"}, {"dia": "miercoles", "cierre": "10:00 PM", "apertura": "05:00 PM"}, {"dia": "jueves", "cierre": "10:00 PM", "apertura": "05:00 PM"}, {"dia": "viernes", "cierre": "10:00 PM", "apertura": "05:00 PM"}, {"dia": "sabado", "cierre": "10:00 PM", "apertura": "05:00 PM"}, {"dia": "domingo", "cierre": "10:00 PM", "apertura": "05:00 PM"}]}	t	2025-06-09 21:27:58.372026	2025-06-09 23:20:05.408016	1
9	CHARCUTERIA  LA ESMERALDA 	Charcuteria 	1026594896	Productos cárnicos artesanales y panadería de mása-madre	Diana 	esmeraldacharcuteria@gmail.com	3208793279	3134089563	Carr 5 #3-46 centro 	1749654705430.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "08:00 PM", "apertura": "09:00 AM"}, {"dia": "martes", "cierre": "08:00 PM", "apertura": "09:00 AM"}, {"dia": "miercoles", "cierre": "08:00 PM", "apertura": "09:00 AM"}, {"dia": "jueves", "cierre": "08:00 PM", "apertura": "09:00 AM"}, {"dia": "viernes", "cierre": "08:00 PM", "apertura": "09:00 AM"}, {"dia": "sabado", "cierre": "08:30 PM", "apertura": "09:00 AM"}, {"dia": "domingo", "cierre": "05:00 PM", "apertura": "09:00 AM"}]}	t	2025-06-11 15:11:45.432224	2025-06-12 17:34:35.037667	1
3	LECHONERIA PITALITO 	Las delicias de mi tierra 	24081827	Disfruta de la mejor lechona 100% carne	Luz mila niño	alvarezwilber262@gmail.com	3133020513	3134089563	Avenida 3 # 13 sur 74 solarte	1749570175887.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}	t	2025-06-10 15:42:55.899809	2025-06-10 15:42:55.899809	1
4	EL PARCHE FASFOOD	El Parche sas	107516260	¿ Salchi o miedo ?	Adriana 	nanatorres1126@gmail.com	3203133646	3134089563	Calle 13 1a16 andes 	1749590264927.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "", "apertura": ""}, {"dia": "martes", "cierre": "10:30 PM", "apertura": "05:00 PM"}, {"dia": "miercoles", "cierre": "10:30 PM", "apertura": "05:00 PM"}, {"dia": "jueves", "cierre": "10:30 PM", "apertura": "05:00 PM"}, {"dia": "viernes", "cierre": "10:30 PM", "apertura": "05:00 PM"}, {"dia": "sabado", "cierre": "10:30 PM", "apertura": "05:00 PM"}, {"dia": "domingo", "cierre": "10:30 PM", "apertura": "05:00 PM"}]}	t	2025-06-10 21:17:44.934961	2025-06-10 21:40:57.866561	1
2	PAC FOOD 	Pac food sas	1083925567	Game Over a tu hambre	Yuli	bahamonyuli@gmail.com	3146313398	3134089563	Carrera 1 # 13-58 cambulos	1749520971546.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "10:20 PM", "apertura": "05:00 PM"}, {"dia": "martes", "cierre": "10:20 PM", "apertura": "05:00 PM"}, {"dia": "miercoles", "cierre": "10:20 PM", "apertura": "05:00 PM"}, {"dia": "jueves", "cierre": "10:20 PM", "apertura": "05:00 PM"}, {"dia": "viernes", "cierre": "10:20 PM", "apertura": "05:00 PM"}, {"dia": "sabado", "cierre": "11:30 PM", "apertura": "04:00 PM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "04:00 PM"}]}	t	2025-06-10 02:02:51.548138	2025-06-12 01:16:56.225683	1
6	BRIOCHET ARTISAN	Briochet artizan 	10245198153	La mejor pizza artesanal de pitalito	Luiz	luisiibarra91@gmail.com	3144537373	3134089563	Carrera 6 este 15 a 36 sur santa barbara	1749613653938.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "11:00 PM", "apertura": "05:00 PM"}, {"dia": "martes", "cierre": "11:00 PM", "apertura": "05:00 PM"}, {"dia": "miercoles", "cierre": "11:00 PM", "apertura": "05:00 PM"}, {"dia": "jueves", "cierre": "11:00 PM", "apertura": "05:00 PM"}, {"dia": "viernes", "cierre": "11:00 PM", "apertura": "05:00 PM"}, {"dia": "sabado", "cierre": "11:00 PM", "apertura": "05:00 PM"}, {"dia": "domingo", "cierre": "11:00 PM", "apertura": "05:00 PM"}]}	t	2025-06-11 03:47:33.941407	2025-06-11 04:00:13.743985	1
5	MAMUT PICADAS 	Pike dónde mamut 	36283978	Las mejores picadas con el mejor sazón de pitalito	Marisol	pjosoeduardo@live.com	3103451052	3134089563	Carrera 7 #10-28 sucre	1749610004656.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "10:00 PM", "apertura": "06:00 PM"}, {"dia": "martes", "cierre": "10:00 PM", "apertura": "06:00 PM"}, {"dia": "miercoles", "cierre": "10:00 PM", "apertura": "06:00 PM"}, {"dia": "jueves", "cierre": "10:00 PM", "apertura": "06:00 PM"}, {"dia": "viernes", "cierre": "10:00 PM", "apertura": "06:00 PM"}, {"dia": "sabado", "cierre": "10:30 PM", "apertura": "04:00 PM"}, {"dia": "domingo", "cierre": "10:30 PM", "apertura": "04:00 PM"}]}	t	2025-06-11 02:46:44.6641	2025-06-11 22:52:48.452436	1
8	SAN DIEGO 	San Diego 	52048853	La mejor opción a la hora de comer	Nora	restaurantesandiegodepitalito@gmail.com	3124617568	3134089563	Carr 5 # 3-42 centro 	1749652647058.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "05:00 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "05:00 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "05:00 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "05:00 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "05:00 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "05:00 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "04:00 PM", "apertura": "08:00 AM"}]}	t	2025-06-11 14:37:27.066444	2025-06-12 18:16:31.676184	1
7	PIZERIA VIANDA 	Pizzería vianda sas	1115941782	Pizzería y comillas rápidas	Alexander ovaller	alvarezwilber262@gmail.com	3124450462	3134089563	Avenida 3 # 10-sur 27 enseguida el atajo jardín	1749616584764.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "11:30 PM", "apertura": "05:00 PM"}, {"dia": "martes", "cierre": "11:30 PM", "apertura": "05:00 PM"}, {"dia": "miercoles", "cierre": "11:30 PM", "apertura": "05:00 PM"}, {"dia": "jueves", "cierre": "11:30 PM", "apertura": "05:00 PM"}, {"dia": "viernes", "cierre": "11:30 PM", "apertura": "05:00 PM"}, {"dia": "sabado", "cierre": "11:30 PM", "apertura": "05:00 PM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "05:00 PM"}]}	t	2025-06-11 04:36:24.765272	2025-06-14 15:26:26.619669	1
10	MI TIERRA 	Mi tierra sas 	96333779	La alegría de comer bien	Yilver	restaurantemitierraamada@gmail.com	3103317330	3134089563	Carrera 1#3-11 quinche 	1749661332372.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}	t	2025-06-11 16:58:32.632485	2025-06-11 17:02:12.378284	1
16	TU SALUD PLUS	Droguería tu salud plus	10839135184	Comprometidos con tu bienestar	Yesisca 	yessicacla14@gmail.com	3203539292	3134089563	Carr 1 # 18-59  San Rafael 	1749691098067.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}	t	2025-06-12 01:18:18.070071	2025-06-12 01:18:18.070071	3
11	TAIWÁN PITALITO 	Taiwan Pitalito 	12233264	Comida típica China y almuerzos ejecutivos	Ruben	restaurantetaiwan12@gmail.com	3132065482	3134089563	Calle 4# 3-38 centro 	1749663623700.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "08:30 PM", "apertura": "10:30 AM"}, {"dia": "martes", "cierre": "08:30 PM", "apertura": "10:30 AM"}, {"dia": "miercoles", "cierre": "08:30 PM", "apertura": "10:30 AM"}, {"dia": "jueves", "cierre": "08:30 PM", "apertura": "10:30 AM"}, {"dia": "viernes", "cierre": "08:30 PM", "apertura": "10:30 AM"}, {"dia": "sabado", "cierre": "08:30 PM", "apertura": "10:30 AM"}, {"dia": "domingo", "cierre": "08:30 PM", "apertura": "10:30 AM"}]}	t	2025-06-11 17:37:36.576064	2025-06-11 17:49:45.107761	1
12	PAPA ALA LAVOYANA 	Papa ala lavoyana 	36294728	El toque secreto en alitas y papitas como para chuparse los dedos	Carolina 	carocape2001@gmail.com	3143017129	3134089563	Carrera quinta este 3 a 11 Sur nogales	1749676382944.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}	t	2025-06-11 21:07:59.029236	2025-06-11 21:13:02.992165	1
13	DELI fas food	Deli fas food 	1094919576	Comidas rapidas	Juan	juan.toromesa@hotmail.com	3105291443	3134089563	Transversal 5 este 15a sur 57 villa cafe	1749680523172.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}	t	2025-06-11 22:22:03.179679	2025-06-11 22:22:03.179679	1
14	SANTA ALITA	Santa alitas sas	901765034	Expertos en alitas	Licet	santaalita.co@gmail.com	3133060669	3134089563	Calle 14 2- 58 	1749683449902.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}	t	2025-06-11 23:10:49.910431	2025-06-11 23:10:49.910431	1
15	LAS DELICIAS DE KIKE	Las delicias de kike	12262748	Disfruta de nuestra variedad en los mejores sándwiches cubano y demás productos 	Enrique 	enrriquevelacarbajal6@gmail.com	3138783907	3134089563	Carrera 1 # 23-14 sur madelena 	1749685405782.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "10:30 PM", "apertura": "05:00 PM"}, {"dia": "martes", "cierre": "10:30 PM", "apertura": "05:00 PM"}, {"dia": "miercoles", "cierre": "10:30 PM", "apertura": "05:00 PM"}, {"dia": "jueves", "cierre": "10:30 PM", "apertura": "05:00 PM"}, {"dia": "viernes", "cierre": "10:30 PM", "apertura": "05:00 PM"}, {"dia": "sabado", "cierre": "10:30 PM", "apertura": "05:00 PM"}, {"dia": "domingo", "cierre": "10:30 PM", "apertura": "05:00 PM"}]}	t	2025-06-11 23:43:25.784725	2025-06-12 00:08:24.854208	1
17	AREPAS EL EXOTICO 	Arepas el exotico 	117488106	El sabor más exótico del caquetá	Dina	Exotico2025@gmail.com	3214586892	3134089563	Carr 1 # 18 -80 portal del Norte 	1749693532529.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}	t	2025-06-12 01:58:52.536524	2025-06-12 01:58:52.536524	1
18	LAS DELICIAS DE RUBY 	Ruby colesterol 	36289415	Sabemos lo que es comer bien. 	Ruby	beltranruby75@gmail.com	3165322883	3134089563	Carrera 3 #5-02 centro 	1749699502968.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "11:00 PM", "apertura": "05:30 PM"}, {"dia": "martes", "cierre": "", "apertura": ""}, {"dia": "miercoles", "cierre": "11:00 PM", "apertura": "05:30 PM"}, {"dia": "jueves", "cierre": "11:30 PM", "apertura": "05:30 PM"}, {"dia": "viernes", "cierre": "11:30 PM", "apertura": "05:30 PM"}, {"dia": "sabado", "cierre": "11:30 PM", "apertura": "05:30 PM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "05:30 PM"}]}	t	2025-06-12 03:38:22.976011	2025-06-12 04:58:07.091388	1
21	PIZZA EXPRESS QUINCHE	Pizza Express sa	12235286	Como en casa, entre amigos 	Javier 	soylaboyano@gmail.com	3132030835	3134089563	Calle 2# 1a 62 quinche	1749739435987.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}	t	2025-06-12 14:43:55.995886	2025-06-12 14:43:55.995886	1
20	PIZZA EXPRESS LAGOS	Pizza Express s.A	12235286	Venga... Pruebe y compruebe! \r\nLa delicia del SABOR	Javier 	soylaboyano@gmail.com	3134026973	3134089563	Carrera 1#2-112 lagos	1749739295420.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "11:00 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "11:00 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "11:00 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "11:00 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "11:00 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "11:00 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:00 PM", "apertura": "07:00 AM"}]}	t	2025-06-12 14:41:35.429279	2025-06-12 15:07:52.875237	1
22	DROGUERÍA Y PAÑALERA PITALITO 	Droguería y pañalera pitalito SAS	12264021	Calidad y confianza	Jhony 	jonysalsa2008@hotmail.es	3115565113	3134089563	Carrera 1b # 3-03 quinche	1749742485198.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}	t	2025-06-12 15:34:45.208512	2025-06-12 15:34:45.208512	3
25	FLAMINGOS 	Flamingos sa	1083867682	Los productos mas deliciosos de la ciudad 	Sandra	sandritaramires03@gmail.com	3203823144	3134089563	Carrera 1 #3bis sur 15 manzanres	1749764532296.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "10:00 PM", "apertura": "10:00 AM"}, {"dia": "martes", "cierre": "10:00 PM", "apertura": "10:00 AM"}, {"dia": "miercoles", "cierre": "10:00 PM", "apertura": "10:00 AM"}, {"dia": "jueves", "cierre": "10:00 PM", "apertura": "10:00 AM"}, {"dia": "viernes", "cierre": "10:00 PM", "apertura": "10:00 AM"}, {"dia": "sabado", "cierre": "10:00 PM", "apertura": "10:00 AM"}, {"dia": "domingo", "cierre": "10:00 PM", "apertura": "10:00 AM"}]}	t	2025-06-12 21:42:12.297992	2025-06-12 21:57:48.471349	1
23	SHANGAI RESTAURANTE 	Shangay sas	7002638146	Auténtica comida china no y ahora	Zheng	dewangzheng@hotmail.como	3115782000	3134089563	Carrera 4#6-20 centro 	1749746606123.jpg	activo	1	{"horarios": [{"dia": "lunes", "cierre": "07:30 PM", "apertura": "10:00 AM"}, {"dia": "martes", "cierre": "07:30 PM", "apertura": "10:00 AM"}, {"dia": "miercoles", "cierre": "07:30 PM", "apertura": "10:00 AM"}, {"dia": "jueves", "cierre": "07:30 PM", "apertura": "10:00 AM"}, {"dia": "viernes", "cierre": "07:30 PM", "apertura": "10:00 AM"}, {"dia": "sabado", "cierre": "07:30 PM", "apertura": "10:00 AM"}, {"dia": "domingo", "cierre": "07:30 PM", "apertura": "10:00 AM"}]}	t	2025-06-12 16:43:26.130585	2025-06-12 17:12:40.914178	1
24	SASON DE ALEJO	Sazón de alejo sa	1083923874	Del llano para el huila	Alejandro Vargas 	maurosanchezvargas@gmail.com	3207443658	3134089563	Carrera 15 # 19b-09 sur siglo 21	1749749849938.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "09:30 PM", "apertura": "08:00 AM"}, {"dia": "martes", "cierre": "09:30 PM", "apertura": "08:00 AM"}, {"dia": "miercoles", "cierre": "09:30 PM", "apertura": "08:00 AM"}, {"dia": "jueves", "cierre": "09:30 PM", "apertura": "08:00 AM"}, {"dia": "viernes", "cierre": "09:30 PM", "apertura": "08:00 AM"}, {"dia": "sabado", "cierre": "09:30 PM", "apertura": "08:00 AM"}, {"dia": "domingo", "cierre": "09:30 PM", "apertura": "08:00 AM"}]}	t	2025-06-12 17:37:29.941518	2025-06-12 17:47:54.190796	1
26	VAINILLA heladería y comillas rápidas	Vainilla 	1083910015	Heladería y comidas rápidas	Gladis	bermeogladys36@gmail.com	 314 5299125	3134089563	Calle 2#1b-23 quinche	1749767352130.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}	t	2025-06-12 22:29:12.13778	2025-06-12 22:29:12.13778	1
28	El AREPAZO	El arepazo s.a	1080932034	El original	Diego 	diegoachuy510@hotmail.com	3143923151	3134089563	Carra 4 #2-91 centro 	1749772931419.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "10:00 PM", "apertura": "03:00 PM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "03:00 PM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "10:00 PM", "apertura": "03:00 PM"}, {"dia": "viernes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}	t	2025-06-13 00:02:11.428815	2025-06-13 00:14:13.618121	1
27	SUCUS	SUCUS sa	36296621	Nos gusta natural 	Diana	nativospitalito@gmail.com	3158751974	3134089563	Calle 2 # 1a - 71 quinche	1749877124144.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "06:30 PM", "apertura": "09:00 AM"}, {"dia": "martes", "cierre": "06:30 PM", "apertura": "09:00 AM"}, {"dia": "miercoles", "cierre": "06:30 PM", "apertura": "09:00 AM"}, {"dia": "jueves", "cierre": "06:30 PM", "apertura": "09:00 AM"}, {"dia": "viernes", "cierre": "06:30 PM", "apertura": "09:00 AM"}, {"dia": "sabado", "cierre": "06:30 PM", "apertura": "09:00 AM"}, {"dia": "domingo", "cierre": "", "apertura": ""}]}	t	2025-06-12 23:14:18.172919	2025-06-14 04:58:44.149752	1
35	FOGON DE ORO	Fogón de oro s.a.s	36290474	El mejor pollo de la ciudad	Enrique 	enriqueropar1973@gmail.com	3160556483	3134089563	Carrera 5 # 6-68 centro 	1749840500191.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}	t	2025-06-13 18:48:20.198404	2025-06-13 18:48:20.198404	1
31	CANDILEJAS 	Candileja sa	17665841	Venta de chorizos ahumados artesanales	Campo Elias 	berriol1998@gmail.com	3132853337	3134089563	Avenida 3 # 17 -99 sur 	1749785604763.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "11:15 PM", "apertura": "02:50 PM"}, {"dia": "martes", "cierre": "", "apertura": ""}, {"dia": "miercoles", "cierre": "11:15 PM", "apertura": "02:56 PM"}, {"dia": "jueves", "cierre": "11:15 PM", "apertura": "02:56 PM"}, {"dia": "viernes", "cierre": "11:15 PM", "apertura": "02:50 PM"}, {"dia": "sabado", "cierre": "11:40 PM", "apertura": "02:50 PM"}, {"dia": "domingo", "cierre": "11:10 PM", "apertura": "02:50 PM"}]}	t	2025-06-13 03:33:24.808414	2025-06-13 03:50:05.217727	1
29	BROSTY ARROZ 	Prosti arroz s.a	10379479479874	BROSTY ARROZ 🥘	Edinson	pollosbrostyarrozp@gmail.com	3151518297	3134089563	Carrera 4#3-31 centro 	1749776472670.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "08:30 PM", "apertura": "10:00 AM"}, {"dia": "martes", "cierre": "08:30 PM", "apertura": "10:00 AM"}, {"dia": "miercoles", "cierre": "08:30 PM", "apertura": "10:00 AM"}, {"dia": "jueves", "cierre": "08:30 PM", "apertura": "10:00 AM"}, {"dia": "viernes", "cierre": "08:30 PM", "apertura": "10:00 AM"}, {"dia": "sabado", "cierre": "09:00 PM", "apertura": "10:00 AM"}, {"dia": "domingo", "cierre": "07:30 PM", "apertura": "10:00 AM"}]}	t	2025-06-13 01:01:12.67881	2025-06-13 15:36:20.292487	1
30	DON CHICHARRÓN 	Don chicharrón	1115068224	Jugoso crocante y sabroso	Jhon	jhon1150@hotmail.com	3204212406	3134089563	Calle 2 # 1a 14 quinche	1749780140129.png	activo	0	{"horarios": [{"dia": "lunes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "10:00 PM", "apertura": "05:00 PM"}, {"dia": "sabado", "cierre": "10:00 PM", "apertura": "05:00 PM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}	t	2025-06-13 02:02:20.131454	2025-06-13 03:26:55.320982	1
19	YAO COMIDAS RAPIDAS 	Yao sas	36295889	Las mejores reliquias de yao	Jacqueline	jacquelinebeltranmunoz@gmail.com	3133902905	3134089563	Carrera 1 # 13-68 cambulos	1749785235905.png	activo	0	{"horarios": [{"dia": "lunes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}	t	2025-06-12 05:30:25.47512	2025-06-13 03:27:15.933601	1
36	HOTEL GRAND PREMIUM PLAZA	Hotel Grand premium plaza s.A	19468491	El hotel que lo tiene todo	Fabio león 	hotelgrandpremiumplaza@gmail.com	3115434648	3134089563	Carrera 4 4-08 centro 2 piso centro 	1749842976085.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}	t	2025-06-13 19:29:36.091585	2025-06-13 19:29:36.091585	1
32	IMPERIO CHINO	Imperio chino SA	1082772766	Comida china comida paisa Sushi verduras y mucho más	Jenifer	imperiochino36@gmail.com	3187736506	3134089563	Carrera 15 # 9 a 20 	1749831155382.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "08:30 PM", "apertura": "11:00 AM"}, {"dia": "martes", "cierre": "08:30 PM", "apertura": "11:00 AM"}, {"dia": "miercoles", "cierre": "08:30 PM", "apertura": "11:00 AM"}, {"dia": "jueves", "cierre": "08:30 PM", "apertura": "11:00 AM"}, {"dia": "viernes", "cierre": "08:30 PM", "apertura": "11:00 AM"}, {"dia": "sabado", "cierre": "08:30 PM", "apertura": "11:00 AM"}, {"dia": "domingo", "cierre": "08:30 PM", "apertura": "11:00 AM"}]}	t	2025-06-13 16:12:35.390421	2025-06-13 16:21:09.923233	1
33	ARROZ, SAZÓN Y SABOR	Arroz sazón y sabor s.a	1099683500	Pitalito huila 	Lisa mota	arrozencanto25@gmail.com	3204088446	3134089563	Calle 4 b 20 13 encanto 	1749834823039.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}	t	2025-06-13 17:13:43.046717	2025-06-13 17:13:43.046717	1
34	CHEF BROASTER 	Chef broaster s.a	1118971340	El mejor pollo a la broaster de la ciudad	Yerly Paola 	yerlypjg@gmail.com	320 8750826	3134089563	Calle 3#3-65 centro 	1749837474427.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}	t	2025-06-13 17:57:54.435667	2025-06-13 17:57:54.435667	1
37	EL GRANJERO 	El granjero s.a	1017271170	Donde todo lo encuentras	Fabio león Muñoz 	fabioleon.0603@gmail.com	3136806563	3134089563	Carr 4 #9-13 centro 	1749843748022.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}	t	2025-06-13 19:42:28.030089	2025-06-13 19:42:28.030089	1
38	TERRA VIVA 	Terra viva s.A	1084252823	Disfruta de cocina con alma y experiencias únicas	Miguel	miguelsalasmendez@gmail.com	3205300112	3134089563	Carrera 4 # 3-76 centro 	1749845210680.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}	t	2025-06-13 20:06:50.689365	2025-06-13 20:06:50.689365	1
39	SalchiPaisa	Salchipaisa s.A	1020490514	Expertos en papas	Carlos Lopes 	salchipaisapitalito@gmail.com	3145896754	3134089563	Carrera 16 a 4-48 san mateo	1749854108300.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "", "apertura": ""}, {"dia": "martes", "cierre": "", "apertura": ""}, {"dia": "miercoles", "cierre": "11:00 PM", "apertura": "04:00 PM"}, {"dia": "jueves", "cierre": "11:00 PM", "apertura": "04:00 PM"}, {"dia": "viernes", "cierre": "11:30 PM", "apertura": "04:00 PM"}, {"dia": "sabado", "cierre": "11:30 PM", "apertura": "03:30 PM"}, {"dia": "domingo", "cierre": "11:00 PM", "apertura": "03:30 PM"}]}	t	2025-06-13 22:35:08.302576	2025-06-13 23:19:41.815529	1
40	DULCE MANIA	Dulcemania s.a	1193208535	Helados y waffles	Cristian vidal 	vidalcf123@gmail.com	3143253124	3134089563	Calle 3 sur 2-79 nogales 	1749856845084.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}	t	2025-06-13 23:20:45.085843	2025-06-13 23:20:45.085843	1
41	AREPAS BY	Arepas by	1214745548	Las mejores arepas de pitalito	Camila	Camilamottamv@hotmail.com	3228532363	3134089563	Calle 4#1b-62 quinche	1749859713134.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}	t	2025-06-14 00:08:33.141549	2025-06-14 00:08:33.141549	1
42	Brunchosos	Brunchosos s.a	1007443458	LOUNGE	Jhonatan 	brunchososcolombia@gmail.com	 318 4951384	3134089563	Carr 1a #3-57 quinche	1749862978135.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "08:30 PM", "apertura": "08:00 AM"}, {"dia": "martes", "cierre": "08:30 PM", "apertura": "08:00 AM"}, {"dia": "miercoles", "cierre": "08:30 PM", "apertura": "08:00 AM"}, {"dia": "jueves", "cierre": "08:30 PM", "apertura": "08:00 AM"}, {"dia": "viernes", "cierre": "08:30 PM", "apertura": "08:00 AM"}, {"dia": "sabado", "cierre": "08:30 PM", "apertura": "08:00 AM"}, {"dia": "domingo", "cierre": "08:30 PM", "apertura": "08:00 AM"}]}	t	2025-06-14 01:02:58.141146	2025-06-14 01:26:14.977781	1
43	ITALIAN PIZZA 	Italian pizza s.A	36288941	Pizza 🍕	Steven	stevengonzalezalvarez15@gmail.com	3124713005	3134089563	Calle 11 a 3-13	1749868232485.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}	t	2025-06-14 02:30:32.492759	2025-06-14 02:30:32.492759	1
45	ASADO HUILENSE Y JUAN VALERIOS	Asado huilense S.A	83226371	El mejor asado huilense	Hermes	hermeslo77@gmail.com	3162268416	3134089563	Carr 1b 11-04 andes	1749925763813.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "10:00 PM", "apertura": "04:00 PM"}, {"dia": "martes", "cierre": "10:00 PM", "apertura": "04:00 PM"}, {"dia": "miercoles", "cierre": "10:00 PM", "apertura": "04:00 PM"}, {"dia": "jueves", "cierre": "10:00 PM", "apertura": "04:00 PM"}, {"dia": "viernes", "cierre": "10:00 PM", "apertura": "04:00 PM"}, {"dia": "sabado", "cierre": "10:00 PM", "apertura": "04:00 PM"}, {"dia": "domingo", "cierre": "", "apertura": ""}]}	t	2025-06-14 18:29:23.820035	2025-06-14 18:36:16.235835	1
44	SGOC	Sgoc S.A	1083921430	Hamburguesas	Carol	carolchilito55@gmail.com	3229361909	3134089563	Carre 3 # 11-14 centro 	1749870136055.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "09:50 PM", "apertura": "03:15 PM"}, {"dia": "martes", "cierre": "09:50 PM", "apertura": "03:15 PM"}, {"dia": "miercoles", "cierre": "09:50 PM", "apertura": "03:15 PM"}, {"dia": "jueves", "cierre": "09:50 PM", "apertura": "03:15 PM"}, {"dia": "viernes", "cierre": "09:50 PM", "apertura": "03:15 PM"}, {"dia": "sabado", "cierre": "09:50 PM", "apertura": "03:15 PM"}, {"dia": "domingo", "cierre": "09:50 PM", "apertura": "03:15 PM"}]}	t	2025-06-14 03:02:16.100508	2025-06-14 20:31:26.174814	1
46	FANTASÍAS PITALITO 	Fantacias Pitalito s.a	1007462637	Más allá de tu imaginación	Yudi	yudinata2020@gmail.com	3118526350	3134089563	Carre 1 # 11-35 andes 	1749930168924.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "07:00 PM", "apertura": "09:00 AM"}, {"dia": "martes", "cierre": "07:00 PM", "apertura": "09:00 AM"}, {"dia": "miercoles", "cierre": "07:00 PM", "apertura": "09:00 AM"}, {"dia": "jueves", "cierre": "07:00 PM", "apertura": "09:00 AM"}, {"dia": "viernes", "cierre": "07:00 PM", "apertura": "09:00 AM"}, {"dia": "sabado", "cierre": "07:00 PM", "apertura": "09:00 AM"}, {"dia": "domingo", "cierre": "", "apertura": ""}]}	t	2025-06-14 19:32:39.131567	2025-06-14 19:59:12.906564	4
47	Gurmerd Fierro rio y mar	Gourmet fierro río y mar	83237762	Fierro pesquería	Ramón fierro 	fierroalfonsoramon@gmail.com	3208546628	3134089563	Calle 1#1-35: lagos	1749933619440.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}	t	2025-06-14 20:40:19.44151	2025-06-14 20:40:19.44151	4
48	CROCAN BROSTER 	Crocan S.A	12264193	El pollo más crocante en la ciudad	Mauricio torres	maurotorresvet@gmail.com	3148726422	3134089563	Carrera 5 # 4-12 centro 	1750035635052.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "08:00 PM", "apertura": "11:00 AM"}, {"dia": "martes", "cierre": "08:00 PM", "apertura": "11:00 AM"}, {"dia": "miercoles", "cierre": "08:00 PM", "apertura": "11:00 AM"}, {"dia": "jueves", "cierre": "08:00 PM", "apertura": "11:00 AM"}, {"dia": "viernes", "cierre": "09:00 PM", "apertura": "11:00 AM"}, {"dia": "sabado", "cierre": "09:00 PM", "apertura": "10:00 AM"}, {"dia": "domingo", "cierre": "09:00 PM", "apertura": "10:00 AM"}]}	t	2025-06-16 01:00:35.06012	2025-06-16 03:20:48.890215	1
49	Lucky perfumería	Lucky s.a	1083925567	Perfumería y algo más	Wilson 	Wilsonvilla199@gmail.com	3209834111	3134089563	Carrera 4-7-68 centro 	1750037190448.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "06:30 PM", "apertura": "09:00 AM"}, {"dia": "martes", "cierre": "06:30 AM", "apertura": "09:00 AM"}, {"dia": "miercoles", "cierre": "06:30 AM", "apertura": "09:00 AM"}, {"dia": "jueves", "cierre": "06:30 PM", "apertura": "09:00 AM"}, {"dia": "viernes", "cierre": "06:30 PM", "apertura": "09:00 AM"}, {"dia": "sabado", "cierre": "06:30 PM", "apertura": "09:00 AM"}, {"dia": "domingo", "cierre": "01:00 PM", "apertura": "09:00 AM"}]}	t	2025-06-16 01:26:30.45545	2025-06-16 15:28:50.422572	4
50	GRAN POLLO	Gran pollo s.a	901758559	Gran pollo	Marta 	Gerenciagranpollo@sofalgastronomia.com	3106097040	3134089563	Carrera 3#7-48 centro 	1750105603496.jpg	activo	0	{"horarios": [{"dia": "lunes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "martes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "miercoles", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "jueves", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "viernes", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "sabado", "cierre": "04:30 PM", "apertura": "07:00 AM"}, {"dia": "domingo", "cierre": "11:30 PM", "apertura": "07:00 AM"}]}	t	2025-06-16 20:26:43.504543	2025-06-16 20:26:43.504543	1
\.


--
-- Data for Name: imagenes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.imagenes (id, nombre, ruta, "creadoEn") FROM stdin;
20	Bruja	1749783376364.jpg	2025-06-13 02:56:16.370848
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.migrations (id, "timestamp", name) FROM stdin;
1	1749261556914	Slectpass1749261556914
2	1749431715052	Horarios1749431715052
3	1749431927694	Horarios1749431927694
\.


--
-- Data for Name: productos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.productos (id, nombre, descripcion, precio, precio_descuento, estado, estado_descuento, unidad, imagen_url, fecha_creacion, fecha_actualizacion, "categoriaId", "comercioId") FROM stdin;
31	Arroz chino	Cerdo pollo camarón jamón	41000	\N	activo	inactivo	unidad	1749664244535.jpg	2025-06-11 17:50:44.544979	2025-06-11 17:50:44.544979	49	11
1	Hawaiana personal 	Piña jamón queso	15000	\N	activo	inactivo	unidad	1749505159987.jpg	2025-06-09 21:39:19.997568	2025-06-09 21:39:19.997568	2	1
32	Arroz oriental	Pollo cerdo jamón camarón	41000	\N	activo	inactivo	unidad	1749664295148.jpg	2025-06-11 17:51:35.159083	2025-06-11 17:51:35.159083	49	11
33	Arroz a la valenciana sencillo	Arroz a la valenciana sencillo	39000	\N	activo	inactivo	unidad	1749664382573.jpg	2025-06-11 17:53:02.584035	2025-06-11 17:53:02.584035	54	11
34	Arroz pollo y camarón	Arroz pollo y camarón	43000	\N	activo	inactivo	unidad	1749664415864.jpg	2025-06-11 17:53:35.873702	2025-06-11 17:53:35.873702	54	11
2	Haiwana pequeña 	Jamón piña queso	36000	\N	activo	inactivo	unidad	1749509762289.jpg	2025-06-09 21:42:20.377031	2025-06-09 21:42:20.377031	2	1
3	Hamburguesa clásica 	Pan carne jamón queso tocineta verduras ripio	15	\N	activo	inactivo	unidad	1749522172144.jpg	2025-06-10 02:22:52.154949	2025-06-10 02:22:52.154949	7	2
4	Hamburguesa Criolla 	Pan-carne-pollo-chorizo-huevo-maiz-queso-tocineta-jamon-lechuga-tomate-ripio-salsas	19000	\N	activo	inactivo	unidad	1749523868638.jpg	2025-06-10 02:51:08.688638	2025-06-10 02:51:08.688638	7	2
5	Hamburguesa mexicana	Pan-carne-chorizo-jamon-queso-tocineta-jalapeños-ripio-verduras.	18000	\N	activo	inactivo	unidad	\N	2025-06-10 02:52:48.931388	2025-06-10 02:52:48.931388	7	2
6	HAMBURGUESA RANCHERA	Pan-carne-chorizo-jamon-queso-tocineta-ripio-verduras-salsas.	18000	\N	activo	inactivo	unidad	\N	2025-06-10 02:54:42.74971	2025-06-10 02:54:42.74971	7	2
7	Hamburguesa Super Queso 	Pan-pollo bañado en salsa de queso -chorizo-tocineta-ripio-verduras.	22000	\N	activo	inactivo	unidad	1749524316301.jpg	2025-06-10 02:58:36.312084	2025-06-10 02:58:36.312084	7	2
8	Hamburguesa Queen	DOBLE EN :Pan-carne-chorizo-jamon-maiz-pollo-queso-tocineta-ripio-verduras.	30000	\N	activo	inactivo	unidad	\N	2025-06-10 03:03:53.721333	2025-06-10 03:03:53.721333	7	2
9	Hamburguesa Especial	Pan-DOBLE carne-chorizo-jamon-queso-tocineta-maiz-pollo-ripio-verduras.	25000	\N	activo	inactivo	unidad	\N	2025-06-10 03:05:10.006295	2025-06-10 03:05:10.006295	7	2
10	PATAKOLO SUPER QUESO 	Base de patacon-pollo bañado en salsa de queso -chorizo-tocineta-huevo de codorniz.	25000	\N	activo	inactivo	unidad	1749524861100.jpg	2025-06-10 03:07:41.142624	2025-06-10 03:07:41.142624	9	2
11	PATAKOLO MIXTO	Base de patacon-carne -pollo-chorizo-queso-maiz-huevo de codorniz.	23000	\N	activo	inactivo	unidad	1749525063910.jpg	2025-06-10 03:11:03.956187	2025-06-10 03:11:03.956187	9	2
12	Picada Pacfood	Carne-pollo-chorizo-cebolla grille-papa francesa-maduro-arepa frita	0	\N	activo	inactivo	unidad	1749525418798.jpg	2025-06-10 03:16:58.801988	2025-06-10 03:16:58.801988	8	2
13	Burguer clássic 	Pan briochet-160grde carne -papas fósforito-queso-lechuga-cebolla-tomate-salsa de la casa	14000	\N	activo	inactivo	unidad	1749592062160.jpg	2025-06-10 21:47:42.213071	2025-06-10 21:47:42.213071	12	4
16	Primavera personal	Tocineta ahumada queso mozzarella durazno	25000	\N	activo	inactivo	unidad	1749614485881.jpg	2025-06-11 04:01:25.892665	2025-06-11 04:01:25.892665	25	6
17	Primavera	Tocineta ahumada queso mozzarella durazno	50000	\N	activo	inactivo	unidad	1749614514397.jpg	2025-06-11 04:01:54.406767	2025-06-11 04:01:54.406767	25	6
19	Pollo con champiñones personal	Pollo mortadela champiñones queso	8000	\N	activo	inactivo	unidad	\N	2025-06-11 04:47:04.875846	2025-06-11 04:47:04.875846	33	7
20	Carnes personal	Carne pollo cerveroni salchichón de pollo mortadela cebolla pimentón queso	9000	\N	activo	inactivo	unidad	\N	2025-06-11 04:47:46.668762	2025-06-11 04:47:46.668762	33	7
21	Hamburguesa sencilla con pan	Lechuga tomate cebolla salteada carne queso mortadela tocineta y huevos de codorniz	13000	\N	activo	inactivo	unidad	\N	2025-06-11 04:48:38.827377	2025-06-11 04:48:38.827377	34	7
22	Hamburguesa mixta	Lechuga tomate cebolla salteada carne pollo queso mortadela tocineta huevos de codorniz porción de arepa	20000	\N	activo	inactivo	unidad	\N	2025-06-11 04:49:19.390136	2025-06-11 04:49:19.390136	34	7
23	Arepa burger	Arepa carne tomate lechuga queso salsa ahumada y tocineta huevos de codorniz	12000	\N	activo	inactivo	unidad	\N	2025-06-11 04:49:55.869923	2025-06-11 04:49:55.869923	37	7
24	Arepa con todo	Carne pollo salchichón piña huevos de codorniz	9000	\N	activo	inactivo	unidad	1749617436381.jpg	2025-06-11 04:50:36.391618	2025-06-11 04:50:36.391618	37	7
26	Arepa tradicional	Carne pollo chicharrón chorizo maíz cebolla queso y huevos de codorniz	12000	\N	activo	inactivo	unidad	\N	2025-06-11 04:51:49.200015	2025-06-11 04:51:49.200015	37	7
28	Pechuga gratinada	350 G de pollo papas salsa BBQ ensalada champiñones y queso	23000	\N	activo	inactivo	unidad	\N	2025-06-11 04:53:22.764287	2025-06-11 04:53:22.764287	43	7
18	Pizza hawaiana 	Piña mortadela queso	8000	\N	activo	inactivo	unidad	\N	2025-06-11 04:46:22.313742	2025-06-11 04:46:22.313742	33	7
27	Pechuga la plancha	350 G de pollo papas salsa BBQ y ensalada	20000	\N	activo	inactivo	unidad	1749618455839.jpg	2025-06-11 04:52:46.256386	2025-06-11 04:52:46.256386	42	7
35	Arroz solo camarón	Arroz solo camarón	46000	\N	activo	inactivo	unidad	1749664446114.jpg	2025-06-11 17:54:06.124239	2025-06-11 17:54:06.124239	54	11
25	Salchipapa sencilla	Papas salchicha pollo huevos de codorniz y queso	12000	\N	activo	inactivo	unidad	1749619484002.jpg	2025-06-11 04:51:16.698253	2025-06-11 04:51:16.698253	41	7
30	Churrasco	400 G de carne más chimichurri patacón arroz blanco papa la francesa ensalada	34000	\N	activo	inactivo	unidad	1749662042375.jpg	2025-06-11 17:14:02.379501	2025-06-11 17:14:02.379501	47	10
36	1/2 arroz chino	Arroz chino	31000	\N	activo	inactivo	unidad	1749664495129.jpg	2025-06-11 17:54:55.140275	2025-06-11 17:54:55.140275	49	11
37	1/2 arroz oriental	Arroz oriental	31000	\N	activo	inactivo	unidad	1749664531664.jpg	2025-06-11 17:55:31.674014	2025-06-11 17:55:31.674014	49	11
38	1/2 arroz a la valenciana sencillo	Arroz a la valenciana	32000	\N	activo	inactivo	unidad	1749664580647.jpg	2025-06-11 17:56:20.658561	2025-06-11 17:56:20.658561	49	11
39	LOMO DE CERDO	Ensalada patacón papas francesa	35000	\N	activo	inactivo	unidad	1749664646707.jpg	2025-06-11 17:57:26.717099	2025-06-11 17:57:26.717099	52	11
40	CHURRASCO 	Ensalada patacón papas francesa	36000	\N	activo	inactivo	unidad	1749664668873.jpg	2025-06-11 17:57:48.885397	2025-06-11 17:57:48.885397	52	11
41	COSTILLA AHUMADA	Ensalada patacón papas francesa	35000	\N	activo	inactivo	unidad	1749664701923.jpg	2025-06-11 17:58:21.934672	2025-06-11 17:58:21.934672	52	11
42	PECHUGA A LA PLANCHA	Ensalada patacón papas francesa	35000	\N	activo	inactivo	unidad	1749664727209.jpg	2025-06-11 17:58:47.220937	2025-06-11 17:58:47.220937	52	11
43	SANCOCHO DE GALLINA LOS DOMINGOS	Plátano yuca papa mazorca aguacate arroz presa solo los domingos	25000	\N	activo	inactivo	unidad	1749664818076.jpg	2025-06-11 18:00:18.085528	2025-06-11 18:00:18.085528	55	11
44	MOJARRA DORADA	Patacón papa la francesa ensalada	34000	\N	activo	inactivo	unidad	\N	2025-06-11 18:02:44.660222	2025-06-11 18:02:44.660222	52	11
45	COCA-COLA 	Cocacola	4000	\N	activo	inactivo	unidad	1749665404104.jpg	2025-06-11 18:10:04.107446	2025-06-11 18:10:04.107446	53	11
29	Salmón en Salsa de maracuyá	Salmón bañado en salsa de maracuyá	45000	\N	activo	inactivo	unidad	1749655910011.jpg	2025-06-11 15:31:50.022026	2025-06-11 15:31:50.022026	44	8
14	Picada Mamut	Papas a la francesa, Salchicha, Maduro y Carnes con cebolla grillé. 	16000	\N	activo	inactivo	unidad	1750127754301.jpg	2025-06-11 03:05:06.741723	2025-06-11 03:05:06.741723	17	5
46	MANZANA PERSONAL	Bebida Postobón	4000	\N	activo	inactivo	unidad	1749665437531.jpg	2025-06-11 18:10:37.544058	2025-06-11 18:10:37.544058	53	11
47	HIT EN CAJA	Bebida hit	6000	\N	activo	inactivo	unidad	1749665471649.jpg	2025-06-11 18:11:11.659883	2025-06-11 18:11:11.659883	53	11
48	BOTELLA DE AGUA	Agua cristal	3000	\N	activo	inactivo	unidad	1749665511511.png	2025-06-11 18:11:51.522079	2025-06-11 18:11:51.522079	53	11
49	MANZANA 1.5	Bebida Postobón	8000	\N	activo	inactivo	unidad	1749665844867.jpg	2025-06-11 18:17:24.877421	2025-06-11 18:17:24.877421	53	11
50	COCA-COLA 1.5	Bebida coca-cola	8000	\N	activo	inactivo	unidad	1749665881696.jpg	2025-06-11 18:18:01.70816	2025-06-11 18:18:01.70816	53	11
51	UVA 1.5	Bebida Postobón	8000	\N	activo	inactivo	unidad	1749665913858.jpg	2025-06-11 18:18:33.867458	2025-06-11 18:18:33.867458	53	11
52	COCA-COLA 3.L	Bebida coca-cola	10000	\N	activo	inactivo	unidad	1749665949544.jpg	2025-06-11 18:19:09.553423	2025-06-11 18:19:09.553423	53	11
53	COLOMBIANA 2.5	Bebida Postobón	10000	\N	activo	inactivo	unidad	1749666009578.jpg	2025-06-11 18:20:09.587902	2025-06-11 18:20:09.587902	53	11
54	LIMONADA	Agua limón azúcar	5000	\N	activo	inactivo	unidad	1749666140041.jpg	2025-06-11 18:22:20.045558	2025-06-11 18:22:20.045558	53	11
55	1/2 ARROZ A LA VALENCIANA ESPECIAL	Arroz a la valenciana especial	39000	\N	activo	inactivo	unidad	1749666249416.jpg	2025-06-11 18:24:09.428049	2025-06-11 18:24:09.428049	49	11
56	1/2 ARROZ POLLO Y CAMARÓN	Arroz pollo camarón	33000	\N	activo	inactivo	unidad	1749666311746.jpg	2025-06-11 18:25:11.756789	2025-06-11 18:25:11.756789	54	11
57	1/2 ARROZ SOLO CAMARÓN	Arroz y camarón	36000	\N	activo	inactivo	unidad	1749666350206.jpg	2025-06-11 18:25:50.219559	2025-06-11 18:25:50.219559	54	11
58	PORCIÓN POLLO CAMARÓN	Pollo camarón	28000	\N	activo	inactivo	unidad	1749666395828.jpg	2025-06-11 18:26:35.839531	2025-06-11 18:26:35.839531	50	11
59	PORCIÓN SOLO CAMARÓN	Camarones	31000	\N	activo	inactivo	unidad	1749666428523.jpg	2025-06-11 18:27:08.533507	2025-06-11 18:27:08.533507	50	11
60	PORCIÓN CHINO	Porción Chino	26000	\N	activo	inactivo	unidad	1749666464649.jpg	2025-06-11 18:27:44.661198	2025-06-11 18:27:44.661198	50	11
61	PORCIÓN ORIENTAL	Porción oriental	26000	\N	activo	inactivo	unidad	1749666492404.jpg	2025-06-11 18:28:12.416932	2025-06-11 18:28:12.416932	50	11
62	PORCIÓN CHINO + PAPAS	Arrochino papas	28000	\N	activo	inactivo	unidad	1749666532001.jpg	2025-06-11 18:28:52.013319	2025-06-11 18:28:52.013319	50	11
63	TORTILLA SENCILLA CHINA	Tortilla China	48000	\N	activo	inactivo	unidad	1749666595016.jpg	2025-06-11 18:29:55.026745	2025-06-11 18:29:55.026745	56	11
64	TORTILLA CHINA ESPECIAL	Tortilla especial	54000	\N	activo	inactivo	unidad	1749666623186.jpg	2025-06-11 18:30:23.196789	2025-06-11 18:30:23.196789	56	11
65	1/2 TORTILLA CHINA SENCILLA	Tortilla China	38000	\N	activo	inactivo	unidad	1749666655990.jpg	2025-06-11 18:30:56.000787	2025-06-11 18:30:56.000787	56	11
66	1/2 TORTILLA CHINA ESPECIAL 	Tortilla especial	44000	\N	activo	inactivo	unidad	1749666691054.jpg	2025-06-11 18:31:31.064473	2025-06-11 18:31:31.064473	56	11
67	ESPAGUETIS MIXTOS SENCILLOS	Espagueti mixto sencillo	41000	\N	activo	inactivo	unidad	\N	2025-06-11 18:32:34.437568	2025-06-11 18:32:34.437568	57	11
69	1/2 espaguetis mixtos sencillos	Espagueti mixtos	34000	\N	activo	inactivo	unidad	1749666836816.jpg	2025-06-11 18:33:56.828242	2025-06-11 18:33:56.828242	57	11
70	1/2 espaguetis mixtos especiales 	Espaguetis mixtos especiales	39000	\N	activo	inactivo	unidad	\N	2025-06-11 18:34:31.003559	2025-06-11 18:34:31.003559	57	11
71	LAIS COLLYS SENCILLO	Verduras con todas las carnes más arroz chino	46000	\N	activo	inactivo	unidad	1749667017486.jpg	2025-06-11 18:36:57.497789	2025-06-11 18:36:57.497789	58	11
72	LAIS COLLYS ESPECIAL	Verduras con todas las carnes más porción de arroz	41000	\N	activo	inactivo	unidad	1749667079563.jpg	2025-06-11 18:37:59.573812	2025-06-11 18:37:59.573812	58	11
73	SHP SUEY SENCILLO	Verduras más porción de arroz	41000	\N	activo	inactivo	unidad	1749667196571.jpg	2025-06-11 18:39:56.580777	2025-06-11 18:39:56.580777	59	11
74	SHOP SUET ESPECIAL 	Verduras más porción de arroz con todas las carnes	49000	\N	activo	inactivo	unidad	1749667258077.jpg	2025-06-11 18:40:58.086482	2025-06-11 18:40:58.086482	59	11
75	1/2 shop SUEY SENCILLO 	Verduras arroz sencillo	34000	\N	activo	inactivo	unidad	1749667319730.jpg	2025-06-11 18:41:59.781733	2025-06-11 18:41:59.781733	59	11
76	1/2 shop SUEY especial 	Verduras más arroz chino con todas las carnes	41000	\N	activo	inactivo	unidad	1749667415912.jpg	2025-06-11 18:43:35.96374	2025-06-11 18:43:35.96374	59	11
77	Pollo chino sencillo	Pollo frito con porción de papa porción de ensalada más caja de arroz chino sencillo	56000	\N	activo	inactivo	unidad	1749667520646.jpg	2025-06-11 18:45:20.659528	2025-06-11 18:45:20.659528	60	11
78	Pollo chino especial	Pollo frito papa la francesa ensalada arroz chino con todas las carnes	62000	\N	activo	inactivo	unidad	1749667593653.jpg	2025-06-11 18:46:33.663695	2025-06-11 18:46:33.663695	60	11
79	1/2 pollo chino sencillo	Pollo frito papa a francesa ensalada arroz chino sencillo	39000	\N	activo	inactivo	unidad	1749667634191.jpg	2025-06-11 18:47:14.202032	2025-06-11 18:47:14.202032	60	11
80	1/2 pollo chino especial	Medio pollo frito papa francesa ensalada arroz chino con todas las carnes	49000	\N	activo	inactivo	unidad	1749667684707.jpg	2025-06-11 18:48:04.717422	2025-06-11 18:48:04.717422	60	11
81	Pollo frito	Pollo normal frito con papa francésa	34000	\N	activo	inactivo	unidad	1749667801871.jpg	2025-06-11 18:50:01.918919	2025-06-11 18:50:01.918919	51	11
82	1/2 pollo frito 	Medio pollo frito con papa francesa	34000	\N	activo	inactivo	unidad	1749667875722.jpg	2025-06-11 18:51:15.77526	2025-06-11 18:51:15.77526	51	11
84	Porción de papas fritas	Papas fritas	5000	\N	activo	inactivo	unidad	1749668044800.jpg	2025-06-11 18:54:04.811648	2025-06-11 18:54:04.811648	50	11
85	LUMPIAS 	Zanahoria repollo pollo cerdo	7000	\N	activo	inactivo	unidad	1749668209631.jpg	2025-06-11 18:56:49.641269	2025-06-11 18:56:49.641269	62	11
83	Encebollado de camarones	Cebolla camarones porción de arroz patacón y salsas	28000	\N	activo	inactivo	unidad	1749668218505.jpg	2025-06-11 18:53:33.636305	2025-06-11 18:53:33.636305	61	11
68	ESPAGUETIS MIXTOS ESPECIALES	Cerdo pollo camaron y arroz chino	49000	\N	activo	inactivo	unidad	\N	2025-06-11 18:33:03.808739	2025-06-11 18:33:03.808739	57	11
89	Picada Ranchera 	Papas a la francesa, Salchicha, Maduro, Carnes con cebolla grillé, Queso, Costillas de cerdo, Butifarra, Chorizo y Salsa BBQ. 	32000	\N	activo	inactivo	unidad	\N	2025-06-11 20:23:06.729034	2025-06-11 20:23:06.729034	17	5
15	Picada Carnaval	Carnes con cebolla grille, salchicha, Maduro, Papa la francesa, Queso, Maíz tierno y Huevos de codorniz 	24000	\N	activo	inactivo	unidad	\N	2025-06-11 03:10:08.128739	2025-06-11 03:10:08.128739	17	5
86	Picada de alas a la BBQ	Papas a la francesa, salchicha, Maduro, Queso, Chorizo, Carnes con cebolla grillé, Alas con miel y Salsa BBQ 	30000	\N	activo	inactivo	unidad	\N	2025-06-11 19:54:21.457297	2025-06-11 19:54:21.457297	17	5
88	Picada Costeña 	Papas a la francesa, Salchicha, Maduro,Lechuga, carnes con cebolla grillé, Queso, Maiz tierno, Butifarra y Chorizo. 	30000	\N	activo	inactivo	unidad	\N	2025-06-11 20:00:05.680155	2025-06-11 20:00:05.680155	17	5
87	Picada Mexicana	Papas a la francesa, Salchicha, Maduro, Nachos, Queso,Chorizo, Carnes con cebolla grillé y Aji al gusto.  	30000	\N	activo	inactivo	unidad	\N	2025-06-11 19:56:30.280236	2025-06-11 19:56:30.280236	17	5
90	Picada Super Mamut 	Papas a la francesa, Salchicha, Maduro, Carnes con cebolla grillé, Doble porción de Queso, Maiz tierno, Chorizo, Salchicha tipo Americana y Chicharrón 	40000	\N	activo	inactivo	unidad	\N	2025-06-11 20:28:17.53929	2025-06-11 20:28:17.53929	17	5
91	Churrasco 	250 g de lomo ancho de res acompañado con porción de papas a la francesa y tajadas de Maduro. 	20000	\N	activo	inactivo	unidad	\N	2025-06-11 20:33:41.46315	2025-06-11 20:33:41.46315	21	5
92	Pechuga Gratinada 	250 g de pechuga de pollo con queso gratinado, acompañada con papas a la francesa y tajadas de Maduro. 	20000	\N	activo	inactivo	unidad	\N	2025-06-11 20:40:10.629495	2025-06-11 20:40:10.629495	21	5
93	Tabla Mixta 	Porción de lomo ancho de res, Pechuga de pollo, Chorizo de las brisas, acompañado con papas a la francesa y tajadas de Maduro. 	30000	\N	activo	inactivo	unidad	\N	2025-06-11 20:44:13.464103	2025-06-11 20:44:13.464103	21	5
94	Alas de pollo BBQ 	Alas de pollo con miel y salsa BBQ acompañadas con papa a la francesa y tajadas de Maduro. 	20000	\N	activo	inactivo	unidad	\N	2025-06-11 20:49:25.723648	2025-06-11 20:49:25.723648	21	5
95	Alas de pollo Gratinadas 	Alas de pollo con queso gratinado, miel y salsa BBQ acompañadas con papa a la francesa y tajadas de Maduro. 	25000	\N	activo	inactivo	unidad	\N	2025-06-11 20:50:51.588424	2025-06-11 20:50:51.588424	21	5
96	Patacón Criollo 	Plátano Verde O Maduro, Carne Y Pollo Desmechado Con Cebolla Grillé, Queso, Maíz Tierno, Huevos De Codorniz, Tocineta Y Chorizo. 	20000	\N	activo	inactivo	unidad	\N	2025-06-11 21:01:35.076758	2025-06-11 21:01:35.076758	21	5
97	Costillas BBQ	Porción de costillas de cerdo en salsa BBQ ,  acompañado con papas a la francesa y tajadas de Maduro.	20000	\N	activo	inactivo	unidad	\N	2025-06-11 21:03:24.13836	2025-06-11 21:03:24.13836	21	5
98	Desgranado Mamut	Base De Ripio De Papa, Carne, Pollo Desmechado Con Cebolla Grillé, Queso, Maíz Tierno, Huevos De Codorniz, Tocineta Y Chorizo. 	18000	\N	activo	inactivo	unidad	\N	2025-06-11 21:12:59.441832	2025-06-11 21:12:59.441832	19	5
99	Desgranado Super Mamut	Base De Ripio De Papá, Carne, Pollo Desmechado Con Cebolla Grillé, Queso, Maíz Tierno, Huevos De Codorniz, Tocineta Y Chorizo. (Mayor cantidad)	22000	\N	activo	inactivo	unidad	\N	2025-06-11 21:20:53.153907	2025-06-11 21:20:53.153907	19	5
100	Mamut Tradicional 	Pan De Hamburguesa, Cebolla Grillé, Lechuga, Tomate, Carne Hamburguesa y Queso. Nota Si La Desean En Plátano Verde O Maduro Tiene Un Costo Adicional De 1.000 Pesos	10000	\N	activo	inactivo	unidad	\N	2025-06-11 21:24:05.770559	2025-06-11 21:24:05.770559	18	5
101	Texana 	Pan De Hamburguesa, Cebolla Grillé, Lechuga, Tomate, Carne Hamburguesa, Chorizo, tocineta y Queso. Nota Si La Desean En Plátano Verde O Maduro Tiene Un Costo Adicional De 1.000 Pesos	12000	\N	activo	inactivo	unidad	\N	2025-06-11 21:25:15.51234	2025-06-11 21:25:15.51234	18	5
102	Pollo 	Pan De Hamburguesa, Cebolla Grillé, Lechuga, Tomate, pechuga de pollo, tocineta y Queso. Nota Si La Desean En Plátano Verde O Maduro Tiene Un Costo Adicional De 1.000 Pesos	15000	\N	activo	inactivo	unidad	\N	2025-06-11 21:26:21.87662	2025-06-11 21:26:21.87662	18	5
104	Super mamut 	Pan De Hamburguesa, Cebolla Grillé, Lechuga, Tomate, Doble Porción De Carne, Tortilla De Huevo, Tocineta Y Doble Queso. Nota Si La Desean En Plátano Verde O Maduro Tiene Un Costo Adicional De 1.000 Pesos	18000	\N	activo	inactivo	unidad	\N	2025-06-11 21:30:18.628534	2025-06-11 21:30:18.628534	18	5
103	Doble Carne 	Pan De Hamburguesa, Cebolla Grillé, Lechuga, Tomate, Doble Porción De Carne, Tocineta Y Queso. Nota Si La Desean En Plátano Verde O Maduro Tiene Un Costo Adicional De 1.000 Pesos	10000	\N	activo	inactivo	unidad	\N	2025-06-11 21:27:53.749476	2025-06-11 21:27:53.749476	18	5
105	Super Mamut Cheddar 	Pan De Hamburguesa, Cebolla Grillé, Lechuga, Tomate, Doble Porción De Carne, Tocineta Y Queso Gratinado con Maíz Tierno.  Nota Si La Desean En Plátano Verde O Maduro Tiene Un Costo Adicional De 1.000 Pesos	22000	\N	activo	inactivo	unidad	\N	2025-06-11 21:33:24.648089	2025-06-11 21:33:24.648089	18	5
106	Mamut	Pan De Perro, Ripio De Papa, Salchicha Tipo Americana, Queso, Tocineta Y Huevos De Codorniz 	10000	\N	activo	inactivo	unidad	\N	2025-06-11 22:19:21.716096	2025-06-11 22:19:21.716096	20	5
107	Super Mamut	Pan De Perro, Ripio De Papa, Salchicha Tipo Americana, Queso, Tocineta, Huevos De Codorniz Y Maíz Tierno. 	12000	\N	activo	inactivo	unidad	\N	2025-06-11 22:21:05.809345	2025-06-11 22:21:05.809345	20	5
108	Golosin Mamut 	Pan De Perro, Ripio De Papa, Carne Y Pollo Desmechado Con Cebolla Grillé, Salchicha Tipo Americana, Queso, Tocineta, Huevos De Codorniz Y Maíz Tierno. 	16000	\N	activo	inactivo	unidad	\N	2025-06-11 22:22:27.547732	2025-06-11 22:22:27.547732	20	5
109	Tadicional 	Porción De Papas A La Francesa Y Salchicha Tipo Americana. Nota: Salsas Al Gusto	10000	\N	activo	inactivo	unidad	\N	2025-06-11 22:25:13.781129	2025-06-11 22:25:13.781129	22	5
110	Salchimaicitos 	Porción De Papas A La Francesa, Salchicha Tipo Americana, Queso, Maíz Tierno Y Huevos De Codorniz. Nota: Salsa Sal Gusto	15000	\N	activo	inactivo	unidad	\N	2025-06-11 22:28:41.807654	2025-06-11 22:28:41.807654	22	5
111	Salchichorizo	Porción De Papas A La Francesa, Salchicha Tipo Americana Y Chorizo De Las Brisas.  Nota: Salsa Sal Gusto	14000	\N	activo	inactivo	unidad	\N	2025-06-11 22:30:09.806267	2025-06-11 22:30:09.806267	22	5
112	Clasit burger 	Carne 1/4 queso vegetales frescos	16000	\N	activo	inactivo	unidad	1749681028956.jpg	2025-06-11 22:30:28.966337	2025-06-11 22:30:28.966337	66	13
113	Salchiranchera	Porción De Papas A La Francesa, Salchicha Tipo Americana, Chorizo De Las Brisas, Tocineta Y Trocitos De Costilla De Cerdo.  Nota: Salsa Sal Gusto	16000	\N	activo	inactivo	unidad	\N	2025-06-11 22:31:24.036015	2025-06-11 22:31:24.036015	22	5
114	Chorizo	Un Chorizo De Las Brisas	5000	\N	activo	inactivo	unidad	\N	2025-06-11 22:37:48.893227	2025-06-11 22:37:48.893227	23	5
115	Maiz 	Una Porción De Maíz Tierno 	4000	\N	activo	inactivo	unidad	\N	2025-06-11 22:40:29.895005	2025-06-11 22:40:29.895005	23	5
116	 Huevos De Codorniz	5 unidades 	4000	\N	activo	inactivo	unidad	\N	2025-06-11 22:42:09.044679	2025-06-11 22:42:09.044679	23	5
117	Queso 	Cuatro Lonchas 	4000	\N	activo	inactivo	unidad	\N	2025-06-11 22:43:48.738229	2025-06-11 22:43:48.738229	23	5
118	Papa a la francesa 	150g de papa 	6000	\N	activo	inactivo	unidad	\N	2025-06-11 22:44:36.749246	2025-06-11 22:44:36.749246	23	5
119	Sándwich costilla ahumada	Costilla ahumada tocineta lechuga tomate queso salsa de ajo bbq	20000	\N	activo	inactivo	unidad	\N	2025-06-12 00:10:10.765751	2025-06-12 00:10:10.765751	69	15
120	Hamburguesa de pollo	Hamburguesa de pollo	18000	\N	activo	inactivo	unidad	1749687367057.jpg	2025-06-12 00:16:07.068402	2025-06-12 00:16:07.068402	70	15
121	Picada Killer	Carne-pollo-chorizo-maiz-queso-cebolla grille-papa francesa-papa criolla-maduro-arepa frita	0	\N	activo	inactivo	unidad	1749688819505.jpg	2025-06-12 00:40:19.510637	2025-06-12 00:40:19.510637	8	2
122	Picada Super Queso	pollo bañado en salsa de queso-chorizo-tocineta-papa francesa-arepa frita	0	\N	activo	inactivo	unidad	1749688964997.jpg	2025-06-12 00:42:45.007262	2025-06-12 00:42:45.007262	8	2
123	Picada criolla	Carne-pollo-chorizo-maiz-cebolla grille-papa criolla-maduro-arepa frita	0	\N	activo	inactivo	unidad	1749689031809.jpg	2025-06-12 00:43:51.860022	2025-06-12 00:43:51.860022	8	2
124	Picada Mexicana	Carne molida-chorizo-tocineta-maiz-queso-papa criolla-papa francesa-jalapeño	0	\N	activo	inactivo	unidad	1749689179400.jpg	2025-06-12 00:46:19.409472	2025-06-12 00:46:19.409472	8	2
125	Pacman Mixto	Pan relleno de carne-pollo-chorizo-maiz -queso-huevo de codorniz-salsas	23000	\N	activo	inactivo	unidad	1749689299042.jpg	2025-06-12 00:48:19.046311	2025-06-12 00:48:19.046311	10	2
222	Ejecutivo de la casa	Sábados domingos y festivos	22000	\N	activo	inactivo	unidad	1749750983055.jpg	2025-06-12 17:56:23.068718	2025-06-12 17:56:23.068718	141	24
126	Pacman Super Queso 	Pan relleno de pollo bañado en salsa de queso -chorizo-tocineta-huevo de codorniz-salsas	25000	\N	activo	inactivo	unidad	1749689369678.jpg	2025-06-12 00:49:29.689794	2025-06-12 00:49:29.689794	10	2
127	Nuggets de pollo	Nuggets  con papa francesa	14000	\N	activo	inactivo	unidad	\N	2025-06-12 00:53:34.890496	2025-06-12 00:53:34.890496	83	2
128	Deditos de queso 	Deditos de queso con bocadillo	14000	\N	activo	inactivo	unidad	\N	2025-06-12 00:54:12.308858	2025-06-12 00:54:12.308858	83	2
129	Perro clásico 	Pan-chorizo-jamon-queso-huevo de codorniz-ripio-salsas.	15000	\N	activo	inactivo	unidad	1749690428628.jpg	2025-06-12 01:07:08.631994	2025-06-12 01:07:08.631994	76	2
130	Perro super queso 🧀 	Pan-chorizo-pollo bañado en salsa de queso-tocineta-huevo de codorniz-ripio-salsas	20000	\N	activo	inactivo	unidad	1749690547944.jpg	2025-06-12 01:09:07.954803	2025-06-12 01:09:07.954803	76	2
131	Costillas BBQ	250 costillas -papa francesa	25000	\N	activo	inactivo	unidad	\N	2025-06-12 01:10:54.873502	2025-06-12 01:10:54.873502	82	2
132	Alistar BBQ	6 porciones de alitas-papa francesa/o criolla (opcional)	25000	\N	activo	inactivo	unidad	\N	2025-06-12 01:11:53.791229	2025-06-12 01:11:53.791229	82	2
133	Pechuga A la Plancha 	Pechuga asada  -papa francesa/o (criolla)(opcional)	25000	\N	activo	inactivo	unidad	\N	2025-06-12 01:12:42.087017	2025-06-12 01:12:42.087017	82	2
134	Pechuga gratinada	Pechuga gratinada con queso acompañado de papá francesa/o criolla (opcional)	25000	\N	activo	inactivo	unidad	\N	2025-06-12 01:13:26.840828	2025-06-12 01:13:26.840828	82	2
135	Churrasco	260 de carne  acompañada de papa  francesa/o criolla (opcional)	25000	\N	activo	inactivo	unidad	\N	2025-06-12 01:14:12.137696	2025-06-12 01:14:12.137696	82	2
136	Mazorcada	Base de patacon /o papa francesa -Carne-pollo-chorizo-maiz-queso-lechuga.	25000	\N	activo	inactivo	unidad	1749690942243.jpg	2025-06-12 01:15:42.286709	2025-06-12 01:15:42.286709	82	2
137	Sándwich carnes 	Pan-carne molida-chorizo-maiz-queso-tocineta-lechuga-tomate	11000	\N	activo	inactivo	unidad	\N	2025-06-12 01:18:41.320826	2025-06-12 01:18:41.320826	78	2
138	Sándwich de queso 	Pan-pollo bañado en salsa de queso -Chorizo-tocineta-lechuga-tomate	12000	\N	activo	inactivo	unidad	\N	2025-06-12 01:23:37.58087	2025-06-12 01:23:37.58087	78	2
139	Sándwich ranchero	Pan-huevo-chorizo-tocineta-maiz-queso-lechuga-tomate	12000	\N	activo	inactivo	unidad	\N	2025-06-12 01:24:57.433058	2025-06-12 01:24:57.433058	78	2
140	Sándwich criollo 	Pan-carne -tocineta-chorizo-queso-lechuga-tomate-maiz	13000	\N	activo	inactivo	unidad	1749691593230.jpg	2025-06-12 01:26:33.23368	2025-06-12 01:26:33.23368	78	2
141	Sándwich super queso 	Pan-pollo bañado en salsa de queso -chorizo-tocineta-lechuga-tomate.	14000	\N	activo	inactivo	unidad	\N	2025-06-12 01:27:45.211333	2025-06-12 01:27:45.211333	78	2
142	Sándwich mexicano	Pan-carne-chorizo-jamon-queso-tocineta-jalapeños-tomate-lechuga.	13000	\N	activo	inactivo	unidad	\N	2025-06-12 01:28:58.44194	2025-06-12 01:28:58.44194	78	2
143	Electrólit	Naranja mandarina	8600	\N	activo	inactivo	unidad	1749691753168.jpg	2025-06-12 01:29:13.21363	2025-06-12 01:29:13.21363	91	16
144	Choripapa clasica	Chorizo las brisas-papa francesa-huevo de codorniz 	14000	\N	activo	inactivo	unidad	1749691847914.jpg	2025-06-12 01:30:47.918942	2025-06-12 01:30:47.918942	77	2
145	Dolex Gripa 	Tabletas * 2	3800	\N	activo	inactivo	unidad	\N	2025-06-12 01:31:00.287277	2025-06-12 01:31:00.287277	88	16
146	Choripapa especial	Chorizo las brisas-queso-maiz-huevo de codorniz-papa francesa-papa criolla	23000	\N	activo	inactivo	unidad	\N	2025-06-12 01:31:34.307229	2025-06-12 01:31:34.307229	77	2
147	Choripapa costeña 	Chorizo las brisas-maiz-queso-lechuga-papa francesa-huevo de codorniz 	23000	\N	activo	inactivo	unidad	\N	2025-06-12 01:32:40.164361	2025-06-12 01:32:40.164361	77	2
148	Burrito tricarne	Tortilla-carne -pollo-chorizo-maiz-queso-verduras.	23000	\N	activo	inactivo	unidad	\N	2025-06-12 01:33:43.549901	2025-06-12 01:33:43.549901	79	2
149	Burrito mexicano	Tortilla-carne molida--chorizo-maiz-tocineta-queso-verduras-jalapeños.	24000	\N	activo	inactivo	unidad	\N	2025-06-12 01:34:42.783117	2025-06-12 01:34:42.783117	79	2
150	Burrito super queso 🧀 	Tortilla-pollo bañado en salsa de queso-chorizo-tocineta-verduras.	25000	\N	activo	inactivo	unidad	\N	2025-06-12 01:35:40.078509	2025-06-12 01:35:40.078509	79	2
151	Mini hamburguesa 	Pan-carne-queso-papa francesa	15000	\N	activo	inactivo	unidad	\N	2025-06-12 01:36:37.33088	2025-06-12 01:36:37.33088	80	2
152	Nuggets de pollo	Nuggets  con papa francesa	14000	\N	activo	inactivo	unidad	\N	2025-06-12 01:36:55.756113	2025-06-12 01:36:55.756113	80	2
153	Salchi junior	Salchicha-huevo de codorniz-papa francesa.	14000	\N	activo	inactivo	unidad	\N	2025-06-12 01:37:38.604758	2025-06-12 01:37:38.604758	80	2
154	Coca cola Personal	Bebedia	5000	\N	activo	inactivo	unidad	\N	2025-06-12 01:38:20.654531	2025-06-12 01:38:20.654531	81	2
155	Coca cola	Litro y medio	9000	\N	activo	inactivo	unidad	\N	2025-06-12 01:38:39.367511	2025-06-12 01:38:39.367511	81	2
156	Jugo Hit	Litro	7000	\N	activo	inactivo	unidad	\N	2025-06-12 01:38:54.059367	2025-06-12 01:38:54.059367	81	2
157	Limonada 	Natural	7000	\N	activo	inactivo	unidad	\N	2025-06-12 01:39:14.720477	2025-06-12 01:39:14.720477	81	2
158	Limonada 	Coco 	10000	\N	activo	inactivo	unidad	\N	2025-06-12 01:39:34.879221	2025-06-12 01:39:34.879221	81	2
159	Limonada 	Yerbabuena 	10000	\N	activo	inactivo	unidad	\N	2025-06-12 01:39:51.813574	2025-06-12 01:39:51.813574	81	2
160	Malteada 	Maracuya 	10000	\N	activo	inactivo	unidad	\N	2025-06-12 01:40:15.409366	2025-06-12 01:40:15.409366	81	2
161	Malteada 	Cafe 	10000	\N	activo	inactivo	unidad	\N	2025-06-12 01:40:33.79698	2025-06-12 01:40:33.79698	81	2
162	Limonada 	Cereza 	9000	\N	activo	inactivo	unidad	\N	2025-06-12 01:40:51.280054	2025-06-12 01:40:51.280054	81	2
163	Agua	Botella	3000	\N	activo	inactivo	unidad	\N	2025-06-12 01:41:41.854188	2025-06-12 01:41:41.854188	81	2
164	Jugos	Naturales	8000	\N	activo	inactivo	unidad	\N	2025-06-12 01:42:24.151967	2025-06-12 01:42:24.151967	81	2
165	Jugos 	Leche	9000	\N	activo	inactivo	unidad	\N	2025-06-12 01:42:38.998442	2025-06-12 01:42:38.998442	81	2
166	Avena 	Natural	10000	\N	activo	inactivo	unidad	\N	2025-06-12 01:43:33.601103	2025-06-12 01:43:33.601103	81	2
167	Milo 	Caliente o frío 	12000	\N	activo	inactivo	unidad	\N	2025-06-12 01:43:56.55598	2025-06-12 01:43:56.55598	81	2
168	AREPA MIXTA	Carne-pollo-chicharrón-queso-mortadela-mortadela-huevos de codorniz	13000	\N	activo	inactivo	unidad	1749694060824.jpg	2025-06-12 02:07:40.836308	2025-06-12 02:07:40.836308	92	17
169	CHORIZO	Arepa con queso guacamole-limón	8000	\N	activo	inactivo	unidad	1749694341033.jpg	2025-06-12 02:12:21.04374	2025-06-12 02:12:21.04374	93	17
170	AREPA QUESO MORTADELA	Arepa con queso y mortadela	5000	\N	activo	inactivo	unidad	1749694380256.jpg	2025-06-12 02:13:00.261035	2025-06-12 02:13:00.261035	92	17
171	AREPA CON DOBLE QUESO	Arepa con doble queso	6000	\N	activo	inactivo	unidad	1749694456339.jpg	2025-06-12 02:14:16.34718	2025-06-12 02:14:16.34718	92	17
173	CARNE AL BARRIL CON SANCOCHO DE HUESO DE CHARRASCO	Carne al barril con sancocho de Carrasco  SOLO LOS DIAS SÁBADO 	20000	\N	activo	inactivo	unidad	1749694665446.jpg	2025-06-12 02:17:45.459008	2025-06-12 02:17:45.459008	96	17
172	BANDEJA PAISA	Frijol aguacate chorizo huevo carne molida arroz chicharrón arepa  SOLO SÁBADO 	20000	\N	activo	inactivo	unidad	1749694602844.jpg	2025-06-12 02:16:42.854452	2025-06-12 02:16:42.854452	97	17
174	SANCOCHO DE GALLINA	Con los mejores ingredientes que le dan el buen sabor	20000	\N	activo	inactivo	unidad	1749695035148.jpg	2025-06-12 02:23:55.152344	2025-06-12 02:23:55.152344	95	17
175	HAMBURGUESA SENCILLA PAN	Pan carne cebolla tomate queso mortadela papa ripio salsas y huevos de codorniz	12000	\N	activo	inactivo	unidad	1749700131620.jpg	2025-06-12 03:48:51.63085	2025-06-12 03:48:51.63085	98	18
223	Salmon	Patacón arroz y ensalada	45000	\N	activo	inactivo	unidad	\N	2025-06-12 17:56:48.570393	2025-06-12 17:56:48.570393	142	24
176	HAMBURGUESA SENCILLA PATACÓN	Patacón-carne-cebolla-queso-tomate-mortadela-papa ripio salsas huevos de codorniz	13000	\N	activo	inactivo	unidad	1749700216194.jpg	2025-06-12 03:50:16.206185	2025-06-12 03:50:16.206185	98	18
177	HAMBURGUESA ESPECIAL PAN	Carne cebolla tomate mortadela queso papa ripio tocineta salsas y huevos de codorniz	18000	\N	activo	inactivo	unidad	1749701847491.jpg	2025-06-12 04:17:27.494941	2025-06-12 04:17:27.494941	98	18
178	HAMBURGUESA ESPECIAL CON PATACÓN	Carne cebolla tomate mortadela queso papa ripio tocineta salsas y huevos de codorniz	13000	\N	activo	inactivo	unidad	1749701890930.jpg	2025-06-12 04:18:10.93403	2025-06-12 04:18:10.93403	98	18
179	HAMBURGUESA GRATINADA PAN	Doble carne cebolla tomate mortadela queso paparripio salsas una capa de queso fundido tocineta y huevos de codorniz	16000	\N	activo	inactivo	unidad	1749701974697.jpg	2025-06-12 04:19:34.707811	2025-06-12 04:19:34.707811	98	18
180	HAMBURGUESA GRATINADA CON PATACÓN	Doble carne cebolla tomate mortadela queso paparripio salsas una capa de queso fundido tocineta y huevos de codorniz	17000	\N	activo	inactivo	unidad	1749702014766.jpg	2025-06-12 04:20:14.776123	2025-06-12 04:20:14.776123	98	18
181	HAMBURGUESA GRATINADA ESPECIAL PAN	Doble carne cebolla tomate mortadela queso papa ripio salsas una capa de queso fundido tocineta y huevos de codorniz	20000	\N	activo	inactivo	unidad	1749702063408.jpg	2025-06-12 04:21:03.412069	2025-06-12 04:21:03.412069	98	18
182	HAMBURGUESA GRATINADA ESPECIAL CON PATACÓN	Doble carne cebolla tomate mortadela queso papa ripio salsas una capa de queso fundido tocineta y huevos de codorniz	20000	\N	activo	inactivo	unidad	1749702130646.jpg	2025-06-12 04:22:10.655904	2025-06-12 04:22:10.655904	98	18
183	SALCHIPAPA SENCILLA	Papa la francesa salchicha queso fundido salsas y huevos de codorniz	13000	\N	activo	inactivo	unidad	1749702172333.jpg	2025-06-12 04:22:52.341781	2025-06-12 04:22:52.341781	100	18
184	SALCHIPAPA ESPECIAL	Papa francesa salchicha chorizo queso fundido salsas y huevo de codorniz	16000	\N	activo	inactivo	unidad	1749702204977.jpg	2025-06-12 04:23:24.987549	2025-06-12 04:23:24.987549	100	18
185	CHORI-PAPA	Papa francesa chorizo queso fundido salsas y huevos de codorniz	14000	\N	activo	inactivo	unidad	\N	2025-06-12 04:24:22.086836	2025-06-12 04:24:22.086836	104	18
186	SALCHIPAPA DOBLE	Salchipapa doble	25000	\N	activo	inactivo	unidad	1749702347079.jpg	2025-06-12 04:25:47.088132	2025-06-12 04:25:47.088132	100	18
187	PERRO SENCILLO	Salchicha rica papa ripio salsas y huevos de codorniz	12000	\N	activo	inactivo	unidad	1749702384539.jpg	2025-06-12 04:26:24.548464	2025-06-12 04:26:24.548464	99	18
188	PERRO ESPECIAL	Salchicha americana papa ripio mortadela tocineta queso fundido salsas y huevos de codorniz	16000	\N	activo	inactivo	unidad	1749702443034.jpg	2025-06-12 04:27:23.044038	2025-06-12 04:27:23.044038	99	18
189	CHORI-PERRO	Chorizos papa ripio mortadela queso fundido salsas y huevos de codorniz	16000	\N	activo	inactivo	unidad	1749702497099.jpg	2025-06-12 04:28:17.104044	2025-06-12 04:28:17.104044	105	18
190	ZUISO-PERRO	Suizo paparripio mortadela queso fundido salsas y huevos de codorniz	16000	\N	activo	inactivo	unidad	1749702562845.jpg	2025-06-12 04:29:22.854303	2025-06-12 04:29:22.854303	106	18
191	ALITAS RELLENAS	Acompañada de arepa o papa	8000	\N	activo	inactivo	unidad	1749702595928.jpg	2025-06-12 04:29:55.93883	2025-06-12 04:29:55.93883	101	18
192	BROCHETA MIXTA	Acompañada de arepa o papa	11000	\N	activo	inactivo	unidad	1749702622729.jpg	2025-06-12 04:30:22.738791	2025-06-12 04:30:22.738791	101	18
193	CHORIZO	Acompañado de arepa o papa	7000	\N	activo	inactivo	unidad	1749702718794.jpg	2025-06-12 04:31:58.803244	2025-06-12 04:31:58.803244	107	18
194	ZUISO	Acompañado de arepa o papa	6000	\N	activo	inactivo	unidad	\N	2025-06-12 04:32:21.948647	2025-06-12 04:32:21.948647	108	18
195	PAPA FRANCESA	Papas fritas	6000	\N	activo	inactivo	unidad	1749702798710.jpg	2025-06-12 04:33:18.720607	2025-06-12 04:33:18.720607	102	18
196	HUEVOS DE CODORNIZ	Huevos cocinados de codorniz	2000	\N	activo	inactivo	unidad	1749702826079.jpg	2025-06-12 04:33:46.088473	2025-06-12 04:33:46.088473	102	18
197	PATACÓN	Plátano frito	2000	\N	activo	inactivo	unidad	1749702850164.jpg	2025-06-12 04:34:10.174535	2025-06-12 04:34:10.174535	102	18
198	QUESO	Queso	2000	\N	activo	inactivo	unidad	1749702871748.jpg	2025-06-12 04:34:31.759234	2025-06-12 04:34:31.759234	102	18
199	AREPAS	Arepa asada blanca	1000	\N	activo	inactivo	unidad	1749702902182.jpg	2025-06-12 04:35:02.191993	2025-06-12 04:35:02.191993	102	18
200	TOCINETA	Tocineta de cerdo ahumada	2000	\N	activo	inactivo	unidad	1749702929006.jpg	2025-06-12 04:35:29.016294	2025-06-12 04:35:29.016294	102	18
201	COCA-COLA 3L	Coca-cola	12000	\N	activo	inactivo	unidad	1749703046610.jpg	2025-06-12 04:37:26.619882	2025-06-12 04:37:26.619882	103	18
202	COCA-COLA 1.5	Cocacola	8000	\N	activo	inactivo	unidad	1749703082040.jpg	2025-06-12 04:38:02.049367	2025-06-12 04:38:02.049367	103	18
203	CUATRO 1.5	Cuatro 	8000	\N	activo	inactivo	unidad	1749703203219.jpg	2025-06-12 04:40:03.223068	2025-06-12 04:40:03.223068	103	18
204	HIT 1.5	Bebida Postobón	8000	\N	activo	inactivo	unidad	1749703339856.jpg	2025-06-12 04:42:19.866273	2025-06-12 04:42:19.866273	103	18
205	COLOMBIANA 1.5 L	bebida postón	8000	\N	activo	inactivo	unidad	1749703437956.webp	2025-06-12 04:43:58.000641	2025-06-12 04:43:58.000641	103	18
206	COCA-COLA PERSONAL	Bebida coca-cola	4000	\N	activo	inactivo	unidad	1749703560940.jpg	2025-06-12 04:46:00.950479	2025-06-12 04:46:00.950479	103	18
207	CUATRO PERSONAL	Bebida coca-cola	4000	\N	activo	inactivo	unidad	1749703684742.jpg	2025-06-12 04:48:04.746743	2025-06-12 04:48:04.746743	103	18
210	CERVEZA ÁGUILA	Debía embriagante	4000	\N	activo	inactivo	unidad	1749704037643.jpg	2025-06-12 04:53:57.652583	2025-06-12 04:53:57.652583	103	18
209	UVA PERSONAL	Postobón 	4000	\N	inactivo	inactivo	unidad	1749703954638.jpg	2025-06-12 04:52:34.64896	2025-06-12 04:52:34.64896	103	18
208	NARANJA PERSONAL	Postobón 	4000	\N	inactivo	inactivo	unidad	1749703918503.jpg	2025-06-12 04:51:58.513495	2025-06-12 04:51:58.513495	103	18
211	Oklahoma	2 carnes 60 gr smash con cebolla 2 quesos y mermelada de tocineta	19000	\N	activo	inactivo	unidad	1749708017877.jpg	2025-06-12 06:00:17.889219	2025-06-12 06:00:17.889219	66	13
212	Oklahoma burger COMBO	2 carnes 60 gr smash con cebolla 2 quesos y mermelada de tocineta	25000	\N	activo	inactivo	unidad	1749708098910.jpg	2025-06-12 06:01:38.921727	2025-06-12 06:01:38.921727	66	13
213	Pizza hawaiana 	Jamón queso piña	9000	\N	activo	inactivo	unidad	1749740327846.jpg	2025-06-12 14:58:47.853017	2025-06-12 14:58:47.853017	114	20
214	pollo con champinon	Queso champiñones pollo cerberoni	9000	\N	activo	inactivo	unidad	1749741224095.jpg	2025-06-12 15:13:44.099394	2025-06-12 15:13:44.099394	114	20
215	Speed max	Postobón 	2500	\N	activo	inactivo	unidad	1749742997503.jpg	2025-06-12 15:43:17.513722	2025-06-12 15:43:17.513722	124	22
216	Lumpias	Lumpias	4000	\N	activo	inactivo	unidad	1749747628366.jpg	2025-06-12 17:00:28.416149	2025-06-12 17:00:28.416149	125	23
217	1/4 pollo+arroz chino+papas (2 personas)	1/4 pollo+arroz chino+papas (2 personas)	24000	\N	activo	inactivo	unidad	1749748097469.jpg	2025-06-12 17:08:17.479768	2025-06-12 17:08:17.479768	126	23
218	1/2 pollo+arroz chino+papas ensalada (4 personas )	1/2 pollo+arroz chino+papas ensalada (4 personas )	36000	\N	activo	inactivo	unidad	1749748232330.jpg	2025-06-12 17:10:32.341551	2025-06-12 17:10:32.341551	126	23
219	PAN DE MASA MADRE RUSTICO 	Pan de masa madre por 500 gramos 	18000	\N	activo	inactivo	unidad	\N	2025-06-12 17:41:34.569162	2025-06-12 17:41:34.569162	135	9
220	Chorizo asado	Acompañado de papa yuca o arepa	10000	\N	activo	inactivo	unidad	1749750894326.jpg	2025-06-12 17:54:54.337039	2025-06-12 17:54:54.337039	139	24
221	Res a la plancha o pechuga a la plancha	Acompañado de arroz blanco tajadas de maduro arepa sopa limonada o café	15000	\N	activo	inactivo	unidad	1749750951925.jpg	2025-06-12 17:55:51.935432	2025-06-12 17:55:51.935432	140	24
224	Pernil de pollo	Acompañado de papa yuca o arepa y maduro melado	17000	\N	activo	inactivo	unidad	\N	2025-06-12 17:57:19.863227	2025-06-12 17:57:19.863227	143	24
225	Huevo frito	Huevo frito	2000	\N	activo	inactivo	unidad	1749751064769.jpg	2025-06-12 17:57:44.782249	2025-06-12 17:57:44.782249	144	24
226	Fettuccine a la bolonesa	Fresco 195 G servido con una deliciosa carne molida salsa boloñesa casera 80 gramos queso parmesano 40 gramos	36000	\N	activo	inactivo	unidad	1749751166953.jpg	2025-06-12 17:59:26.965094	2025-06-12 17:59:26.965094	145	24
227	De carne (pan)	150 gr de carne 100% punta de anca lomo ancho y lomo fino molido tomate cebolla grillé lechuga papa ripio y salsas de la casa	15000	\N	activo	inactivo	unidad	1749751230379.jpg	2025-06-12 18:00:30.395004	2025-06-12 18:00:30.395004	146	24
228	Limonada	1/2jarra	7000	\N	activo	inactivo	unidad	1749751294949.jpg	2025-06-12 18:01:34.954803	2025-06-12 18:01:34.954803	149	24
229	Naranjada 	Jugo de naranja	5000	\N	activo	inactivo	unidad	1749751340855.jpg	2025-06-12 18:02:20.867166	2025-06-12 18:02:20.867166	149	24
230	Cookie flamingos 	Cookie flamingos	14000	\N	activo	inactivo	unidad	1749765650143.jpg	2025-06-12 22:00:50.147986	2025-06-12 22:00:50.147986	159	25
231	Ensalada de fruta sencilla	Tornado de fruta acompañada de crema de la casa yogurt queso gelatina y helado	11500	\N	activo	inactivo	unidad	1749767727016.jpg	2025-06-12 22:35:27.02065	2025-06-12 22:35:27.02065	165	26
232	Ensalada de frutas especial	Tornado de fruta acompañada de crema de la casa o yogurt queso gelatina y doble helado	13500	\N	activo	inactivo	unidad	1749767833465.jpg	2025-06-12 22:37:13.473959	2025-06-12 22:37:13.473959	165	26
233	Ensalada de frutas especial en canasta	Tornado de fruta acompañada de crema de la casa o yogurt queso gelatina doble helado y deliciosa galleta crocante	15500	\N	activo	inactivo	unidad	1749768308130.jpg	2025-06-12 22:45:08.142703	2025-06-12 22:45:08.142703	165	26
256	1 pollo+arroz+especial+papas+ensalada (6personas)	1 pollo+arroz+especial+papas+ensalada (6personas)	60000	\N	activo	inactivo	unidad	1749789371733.jpg	2025-06-13 04:36:11.744026	2025-06-13 04:36:11.744026	126	23
257	Arroz especial (2 personas)	Arroz especial (2 personas)	25000	\N	activo	inactivo	unidad	1749789565970.jpg	2025-06-13 04:39:25.973533	2025-06-13 04:39:25.973533	127	23
258	Arroz especial+papas+ensalada (4 personas )	Arroz especial+papas+ensalada (4 personas )	35000	\N	activo	inactivo	unidad	1749789719409.jpg	2025-06-13 04:41:59.41943	2025-06-13 04:41:59.41943	127	23
234	VITAMAX 12 ONZ	Pulpa de kiwi+limón+maracuyá+piña+jugo de naranja	8000	\N	activo	inactivo	unidad	1749847549243.jpeg	2025-06-12 23:23:49.626826	2025-06-12 23:23:49.626826	173	27
235	VITAMAX 16 ONZ	Pulpa de kiwi+limón+maracuyá+piña+jugo de naranja	9500	\N	activo	inactivo	unidad	1749847503985.jpeg	2025-06-12 23:24:18.33858	2025-06-12 23:24:18.33858	173	27
237	Arepazo 	Carne pollo piña queso huevos de codorniz	12000	\N	activo	inactivo	unidad	1749774000060.jpg	2025-06-13 00:20:00.095523	2025-06-13 00:20:00.095523	184	28
238	Trifásica	Carne porche+pollo desmechado+carne desmechada+huevo de codorniz	15000	\N	activo	inactivo	unidad	1749774097227.jpg	2025-06-13 00:21:37.23538	2025-06-13 00:21:37.23538	184	28
239	CHORI-PAPA 	Acompañada de queso gratinado y huevos de codorniz	20000	\N	activo	inactivo	unidad	1749774178620.jpg	2025-06-13 00:22:58.631112	2025-06-13 00:22:58.631112	185	28
240	Salchipapa ranchera	Acompañada de queso gratinado y huevos de codorniz	19000	\N	activo	inactivo	unidad	1749774234734.jpg	2025-06-13 00:23:54.745421	2025-06-13 00:23:54.745421	185	28
241	LIMONADA DE COCO	Coco limón	10000	\N	activo	inactivo	unidad	1749774281741.jpg	2025-06-13 00:24:41.758071	2025-06-13 00:24:41.758071	186	28
242	Limonada cerezada	Limón cereza	10000	\N	activo	inactivo	unidad	1749774313996.jpg	2025-06-13 00:25:14.001905	2025-06-13 00:25:14.001905	186	28
243	ALITAS BBQ	Alitas bbq	20000	\N	activo	inactivo	unidad	1749774356826.jpg	2025-06-13 00:25:56.839179	2025-06-13 00:25:56.839179	187	28
244	SUPER PATACÓN 	Carne desmechada+pollo desmechado+cerdo desechado+vegetales+queso derretido+ripio	20000	\N	activo	inactivo	unidad	1749774488195.jpg	2025-06-13 00:28:08.205794	2025-06-13 00:28:08.205794	187	28
245	PERRO CALIENTE SENCILLO	Pan salchicha salsas	16000	\N	inactivo	inactivo	unidad	\N	2025-06-13 00:29:20.813642	2025-06-13 00:29:20.813642	189	28
246	Proteína tradicional  12 onz	Banano+fresa+avena+proteína wey+leche entera/leche de almendras 	11500	\N	activo	inactivo	unidad	1749775788789.jpg	2025-06-13 00:49:48.800265	2025-06-13 00:49:48.800265	174	27
247	Proteína tradicional 16 onz	Banano+ fresa+avena+proteína wey+ leche opcional entera o de almendras 	13500	\N	activo	inactivo	unidad	1749775894861.jpg	2025-06-13 00:51:34.87309	2025-06-13 00:51:34.87309	174	27
248	Proteína tradicional 22 onz	Banano+ fresa+avena+proteína wey+ leche entera o de almendras 	15000	\N	activo	inactivo	unidad	1749775999159.jpg	2025-06-13 00:53:19.170719	2025-06-13 00:53:19.170719	174	27
249	POLLO ENTERO	Papa arepa maduro	34500	\N	activo	inactivo	unidad	1749776769736.jpg	2025-06-13 01:06:09.746508	2025-06-13 01:06:09.746508	190	29
250	POLLO ENTERO	papa la francesa	37500	\N	activo	inactivo	unidad	1749776802177.jpg	2025-06-13 01:06:42.189789	2025-06-13 01:06:42.189789	190	29
251	PICADA PERSONAL 	Chicharrón carnudo 300gr + papa criolla 200gr+maduro 100gr + arepa 1+ guacamole 1 +empaque	24500	\N	activo	inactivo	unidad	1749780771466.jpg	2025-06-13 02:12:51.470009	2025-06-13 02:12:51.470009	196	30
252	Chorizo artesanal	Chorizo 120 gr limón arepa 	6000	\N	activo	inactivo	unidad	1749786126410.jpg	2025-06-13 03:42:06.425544	2025-06-13 03:42:06.425544	203	31
253	Coca-cola personal	Coca-cola	4000	\N	activo	inactivo	unidad	1749786174166.jpg	2025-06-13 03:42:54.177919	2025-06-13 03:42:54.177919	205	31
254	1/2 pollo arroz especial papas (4 personas)	1/2 pollo arroz especial papas (4 personas)	46000	\N	activo	inactivo	unidad	1749789136713.jpg	2025-06-13 04:32:16.72459	2025-06-13 04:32:16.72459	126	23
255	1 pollo+arroz+chino+papas+ensalada (6personas)	1 pollo+arroz+chino+papas+ensalada (6personas)	50000	\N	activo	inactivo	unidad	1749789306877.jpg	2025-06-13 04:35:06.887165	2025-06-13 04:35:06.887165	126	23
259	Arroz especial+papas+ensalada (6 personas )	Arroz especial+papas+ensalada (6 personas )	45000	\N	activo	inactivo	unidad	1749789811655.jpg	2025-06-13 04:43:31.671652	2025-06-13 04:43:31.671652	127	23
260	Arroz+camarones+papas+ensalada ( 4 personas )	Arroz+camarones+papas+ensalada ( 4 personas )	43000	\N	activo	inactivo	unidad	1749790321758.jpg	2025-06-13 04:52:01.773111	2025-06-13 04:52:01.773111	127	23
261	Arroz+camarones+papas+ensalada (  personas )	Arroz+camarones+papas+ensalada ( 6 personas )	51000	\N	activo	inactivo	unidad	1749790370325.jpg	2025-06-13 04:52:50.335986	2025-06-13 04:52:50.335986	127	23
262	1/4 pollo frito+papas	1/4 pollo frito+papas	11000	\N	activo	inactivo	unidad	1749790436736.jpg	2025-06-13 04:53:56.74717	2025-06-13 04:53:56.74717	129	23
263	1/2 pollo frito+papas	1/2 pollo frito+papas	21000	\N	activo	inactivo	unidad	1749790499453.jpg	2025-06-13 04:54:59.464193	2025-06-13 04:54:59.464193	129	23
264	1 pollo frito+papa+ensalada 	1 pollo frito+papa+ensalada 	31000	\N	activo	inactivo	unidad	1749790606089.jpg	2025-06-13 04:56:46.099538	2025-06-13 04:56:46.099538	129	23
265	Mojarra frita+arroz chino+papas	Mojarra frita+arroz chino+papas	26000	\N	activo	inactivo	unidad	1749790841179.jpg	2025-06-13 05:00:41.189691	2025-06-13 05:00:41.189691	130	23
266	Pollo milanesa+arroz chino+papas	Pollo milanesa+arroz chino+papas	23000	\N	activo	inactivo	unidad	1749790945948.jpg	2025-06-13 05:02:25.958859	2025-06-13 05:02:25.958859	129	23
267	Cerdo a la plancha arroz chino papas	Cerdo a la plancha arroz chino papas	23000	\N	activo	inactivo	unidad	1749791249864.jpg	2025-06-13 05:07:29.910774	2025-06-13 05:07:29.910774	130	23
268	Pollo agridulce+arroz chino	Pollo agridulce+arroz chino	26000	\N	activo	inactivo	unidad	1749791402529.jpg	2025-06-13 05:10:02.544812	2025-06-13 05:10:02.544812	129	23
269	Cerdo agridulce+arroz chino	Cerdo agridulce+arroz chino	26000	\N	activo	inactivo	unidad	1749791591017.jpg	2025-06-13 05:13:11.067126	2025-06-13 05:13:11.067126	130	23
270	Chop SUEY+arroz chino (2 personas)	Chop SUEY+arroz chino (2 personas)	30000	\N	activo	inactivo	unidad	1749791721992.jpg	2025-06-13 05:15:22.002262	2025-06-13 05:15:22.002262	131	23
271	Chop SUEY+arroz chino (3 personas)	Chop SUEY+arroz chino (3 personas)	35000	\N	activo	inactivo	unidad	1749791759441.jpg	2025-06-13 05:15:59.450911	2025-06-13 05:15:59.450911	131	23
272	Chop SUEY+arroz chino (5 personas)	Chop SUEY+arroz chino (5 personas)	45000	\N	activo	inactivo	unidad	1749791800420.jpg	2025-06-13 05:16:40.424614	2025-06-13 05:16:40.424614	131	23
273	Espaguetis	Espaguetis	25000	\N	activo	inactivo	unidad	1749791935069.jpg	2025-06-13 05:18:55.072483	2025-06-13 05:18:55.072483	132	23
274	Cazuela de camarones	Cazuela de camarones	27000	\N	activo	inactivo	unidad	1749792012540.jpg	2025-06-13 05:20:12.552196	2025-06-13 05:20:12.552196	133	23
275	CAMU CAMU 22 onz	Pulpa de camu camu + miel + base(agua, leche, jugo de naranja)	15000	\N	activo	inactivo	unidad	1749829460812.jpeg	2025-06-13 15:44:20.82532	2025-06-13 15:44:20.82532	179	27
276	CAMU CAMU 16 onz	Pulpa de camu camu + miel + base(agua, leche, jugo de naranja)	14000	\N	activo	inactivo	unidad	1749829512093.jpeg	2025-06-13 15:45:12.105668	2025-06-13 15:45:12.105668	179	27
277	CAMU CAMU 12 onz	Pulpa de camu camu + miel + base(agua, leche, jugo de naranja)	11000	\N	activo	inactivo	unidad	1749829548559.jpeg	2025-06-13 15:45:48.562878	2025-06-13 15:45:48.562878	179	27
284	VERDE 22 ONZ	Pulpa de apio+piña+nopal+espinaca+pepino+jugo de naranja	11000	\N	activo	inactivo	unidad	1749830325218.jpeg	2025-06-13 15:58:45.232248	2025-06-13 15:58:45.232248	173	27
285	VERDE 16 ONZ	Pulpa de apio+piña+nopal+espinaca+pepino+jugo de naranja	9500	\N	activo	inactivo	unidad	1749830369084.jpeg	2025-06-13 15:59:29.097058	2025-06-13 15:59:29.097058	173	27
286	VERDE 12 ONZ	Pulpa de apio+piña+nopal+espinaca+pepino+jugo de naranja	8000	\N	activo	inactivo	unidad	1749830413053.jpeg	2025-06-13 16:00:13.068367	2025-06-13 16:00:13.068367	173	27
287	LIMONADA DE SANDIA 22 ONZ	Pulpa de sandia + agua + limón + azúcar	13000	\N	activo	inactivo	unidad	1749830584868.jpeg	2025-06-13 16:03:04.879141	2025-06-13 16:03:04.879141	183	27
288	LIMONADA DE SANDIA 16 ONZ	Pulpa de sandia + agua + limón + azúcar	12000	\N	activo	inactivo	unidad	1749830625978.jpeg	2025-06-13 16:03:45.993338	2025-06-13 16:03:45.993338	183	27
289	LIMONADA DE SANDIA 12 ONZ	Pulpa de sandia + agua + limón + azúcar	11000	\N	activo	inactivo	unidad	1749830757450.jpeg	2025-06-13 16:05:57.461322	2025-06-13 16:05:57.461322	183	27
290	MANGO TANGO 22 ONZ	Pulpa de mango + jugo de naranja	12000	\N	activo	inactivo	unidad	1749830907504.jpeg	2025-06-13 16:08:27.514857	2025-06-13 16:08:27.514857	181	27
291	MANGO TANGO 16 ONZ	Pulpa de mango + jugo de naranja	9500	\N	activo	inactivo	unidad	1749830959420.jpeg	2025-06-13 16:09:19.431626	2025-06-13 16:09:19.431626	181	27
292	MANGO TANGO 12 ONZ	Pulpa de mango + jugo de naranja	8000	\N	activo	inactivo	unidad	1749831003782.jpeg	2025-06-13 16:10:03.794734	2025-06-13 16:10:03.794734	181	27
296	Arroz a la valenciana personal	Arroz chino con jamón pechuga raíz cebolla pollo frito papa la francesa	17000	\N	activo	inactivo	unidad	1749831856756.jpg	2025-06-13 16:24:16.768309	2025-06-13 16:24:16.768309	208	32
293	Arroz a la valenciana CAJA	Arroz chino con jamón pechuga raíz cebolla pollo frito papa la francesa	54000	\N	activo	inactivo	unidad	1749831776753.jpg	2025-06-13 16:22:56.765629	2025-06-13 16:22:56.765629	208	32
294	Arroz a la valenciana MEDIA CAJA	Arroz chino con jamón pechuga raíz cebolla pollo frito papa la francesa	37000	\N	activo	inactivo	unidad	1749831803578.jpg	2025-06-13 16:23:23.589272	2025-06-13 16:23:23.589272	208	32
295	Arroz a la valenciana CUARTO	Arroz chino con jamón pechuga raíz cebolla pollo frito papa la francesa	25000	\N	activo	inactivo	unidad	1749831836898.jpg	2025-06-13 16:23:56.909758	2025-06-13 16:23:56.909758	208	32
297	Arroz oriental CAJA	Arroz chino+trozos de pechuga+camarón cerdo+jamón	54000	\N	activo	inactivo	unidad	1749832008016.jpg	2025-06-13 16:26:48.028029	2025-06-13 16:26:48.028029	208	32
298	Arroz oriental MEDIA CAJA	Arroz chino con jamón pechuga raíz cebolla pollo frito papa la francesa	33000	\N	activo	inactivo	unidad	1749832049852.jpg	2025-06-13 16:27:29.862613	2025-06-13 16:27:29.862613	208	32
299	Arroz oriental CUARTO 	Arroz chino con jamón pechuga raíz cebolla pollo frito papa la francesa	25000	\N	activo	inactivo	unidad	1749832085009.jpg	2025-06-13 16:28:05.021491	2025-06-13 16:28:05.021491	208	32
300	Arroz oriental PERSONAL	Arroz chino con jamón pechuga raíz cebolla pollo frito papa la francesa	17000	\N	activo	inactivo	unidad	1749832115245.jpg	2025-06-13 16:28:35.259474	2025-06-13 16:28:35.259474	208	32
301	PARFAIT 22 ONZ	Dos frutas a escoger: kiwi, mango, uva chilena, melocotón, manzana verde, banano, pera, fresa, arándano + yogur + miel	14000	\N	activo	inactivo	unidad	1749835073949.jpeg	2025-06-13 17:17:53.95489	2025-06-13 17:17:53.95489	178	27
302	PARFAIT 16 ONZ	Dos frutas a escoger: kiwi, mango, uva chilena, melocotón, manzana verde, banano, pera, fresa, arándano + yogur + miel	12000	\N	activo	inactivo	unidad	1749835190241.jpeg	2025-06-13 17:19:50.252621	2025-06-13 17:19:50.252621	178	27
303	PARFAIT 12 ONZ	Dos frutas a escoger: kiwi, mango, uva chilena, melocotón, manzana verde, banano, pera, fresa, arándano + yogur + miel	10500	\N	activo	inactivo	unidad	1749835237895.jpeg	2025-06-13 17:20:37.89909	2025-06-13 17:20:37.89909	178	27
304	Arroz paisa personal	Pollo-chorizo-costilla ahumada-cerdo-maduro-chicharrón-maíz-verduras 	13000	\N	activo	inactivo	unidad	1749835419132.jpg	2025-06-13 17:23:39.142976	2025-06-13 17:23:39.142976	217	33
305	Arroz paisa x2	Pollo-chorizo-costilla ahumada-cerdo-maduro-chicharrón-maíz-verduras 	23000	\N	activo	inactivo	unidad	1749835448400.jpg	2025-06-13 17:24:08.410011	2025-06-13 17:24:08.410011	217	33
306	Arroz paisa x3	Pollo-chorizo-costilla ahumada-cerdo-maduro-chicharrón-maíz-verduras 	30000	\N	activo	inactivo	unidad	\N	2025-06-13 17:24:30.246957	2025-06-13 17:24:30.246957	217	33
307	Arroz paisa x4 	Pollo-chorizo-costilla ahumada-cerdo-maduro-chicharrón-maíz-verduras 	40000	\N	activo	inactivo	unidad	1749835495770.jpg	2025-06-13 17:24:55.784094	2025-06-13 17:24:55.784094	217	33
308	Arroz paisa x6	Pollo-chorizo-costilla ahumada-cerdo-maduro-chicharrón-maíz-verduras 	50000	\N	activo	inactivo	unidad	1749835519616.jpg	2025-06-13 17:25:19.625798	2025-06-13 17:25:19.625798	217	33
282	MARACUMAN 16 ONZ	Pulpa de maracuyá + mango + yogur griego+ leche + miel	12000	\N	activo	inactivo	unidad	1749830122754.jpeg	2025-06-13 15:55:22.766787	2025-06-13 15:55:22.766787	180	27
281	MARACUMAN 22 ONZ	Pulpa de maracuyá + mango + yogur griego+ leche + miel	14000	\N	activo	inactivo	unidad	1749830073864.jpeg	2025-06-13 15:54:33.876044	2025-06-13 15:54:33.876044	180	27
280	FRUTOS ROJOS 12 ONZ	pulpa de fresa +mora + uva + arándano + yogur griego+ leche + miel 	10000	\N	activo	inactivo	unidad	1749829790775.jpeg	2025-06-13 15:49:50.785285	2025-06-13 15:49:50.785285	180	27
279	FRUTOS ROJOS 16 ONZ	pulpa de fresa +mora + uva + arándano + yogur griego+ leche + miel 	12000	\N	activo	inactivo	unidad	1749829752181.jpeg	2025-06-13 15:49:12.191949	2025-06-13 15:49:12.191949	180	27
278	FRUTOS ROJOS 22 ONZ	pulpa de fresa +mora + uva + arándano + yogur griego + leche + miel 	14000	\N	activo	inactivo	unidad	1749829708936.jpeg	2025-06-13 15:48:28.947816	2025-06-13 15:48:28.947816	180	27
309	PA'YA 22 ONZ	Pulpa de papaya + hierba buena + jugo de limón + jugo de naranja	12000	\N	activo	inactivo	unidad	1749835550032.jpeg	2025-06-13 17:25:50.042868	2025-06-13 17:25:50.042868	181	27
310	Arroz paisa x10 	Pollo-chorizo-costilla ahumada-cerdo-maduro-chicharrón-maíz-verduras 	63000	\N	activo	inactivo	unidad	1749835552948.jpg	2025-06-13 17:25:52.953642	2025-06-13 17:25:52.953642	217	33
311	PA'YA 16 ONZ	Pulpa de papaya + hierba buena + jugo de limón + jugo de naranja	9500	\N	activo	inactivo	unidad	1749835616637.jpeg	2025-06-13 17:26:56.647947	2025-06-13 17:26:56.647947	181	27
312	Arroz ranchero personal	Pollo-chorizo-jamón-salchichón cerberoni-salchicha-verduras-maíz	13000	\N	activo	inactivo	unidad	1749835659650.jpg	2025-06-13 17:27:39.66202	2025-06-13 17:27:39.66202	219	33
313	PA'YA 12 ONZ	Pulpa de papaya + hierba buena + jugo de limón + jugo de naranja	8000	\N	activo	inactivo	unidad	1749835665560.jpeg	2025-06-13 17:27:45.564942	2025-06-13 17:27:45.564942	181	27
314	Arroz ranchero x2	Pollo-chorizo-jamón-salchichón cerberoni-salchicha-verduras-maíz	23000	\N	activo	inactivo	unidad	1749835680349.jpg	2025-06-13 17:28:00.363551	2025-06-13 17:28:00.363551	219	33
315	Arroz ranchero x3	Pollo-chorizo-jamón-salchichón cerberoni-salchicha-verduras-maíz	30000	\N	activo	inactivo	unidad	1749835708262.jpg	2025-06-13 17:28:28.272661	2025-06-13 17:28:28.272661	219	33
316	Arroz ranchero x4 	Pollo-chorizo-jamón-salchichón cerberoni-salchicha-verduras-maíz	40000	\N	activo	inactivo	unidad	1749835738135.jpg	2025-06-13 17:28:58.146684	2025-06-13 17:28:58.146684	219	33
317	Arroz ranchero x6	Pollo-chorizo-jamón-salchichón cerberoni-salchicha-verduras-maíz	50000	\N	activo	inactivo	unidad	1749835764070.jpg	2025-06-13 17:29:24.081378	2025-06-13 17:29:24.081378	219	33
318	Arroz ranchero x10	Pollo-chorizo-jamón-salchichón cerberoni-salchicha-verduras-maíz	63000	\N	activo	inactivo	unidad	1749835794070.jpg	2025-06-13 17:29:54.081576	2025-06-13 17:29:54.081576	219	33
319	ESTELAR 22 ONZ	Pulpa de piña + mango + jugo de naranja	12000	\N	activo	inactivo	unidad	1749835891109.jpeg	2025-06-13 17:31:31.120182	2025-06-13 17:31:31.120182	181	27
320	ESTELAR 16 ONZ	Pulpa de piña + mango + jugo de naranja	9500	\N	activo	inactivo	unidad	1749835944684.jpeg	2025-06-13 17:32:24.688213	2025-06-13 17:32:24.688213	181	27
321	ESTELAR 12 ONZ	Pulpa de piña + mango + jugo de naranja	8000	\N	activo	inactivo	unidad	1749835988500.jpeg	2025-06-13 17:33:08.511772	2025-06-13 17:33:08.511772	181	27
322	NÍTRICO 22 ONZ	Pulpa de sandia + fresa + remolacha(opcional) + jugo de naranja	12000	\N	activo	inactivo	unidad	1749836100694.jpeg	2025-06-13 17:35:00.706162	2025-06-13 17:35:00.706162	181	27
323	NÍTRICO 16 ONZ	Pulpa de sandia + fresa + remolacha(opcional) + jugo de naranja	9500	\N	activo	inactivo	unidad	1749836146768.jpeg	2025-06-13 17:35:46.78118	2025-06-13 17:35:46.78118	181	27
324	NÍTRICO 12 ONZ	Pulpa de sandia + fresa + remolacha(opcional) + jugo de naranja	8000	\N	activo	inactivo	unidad	1749836187862.jpeg	2025-06-13 17:36:27.866574	2025-06-13 17:36:27.866574	181	27
326	VAMPIRO 22 ONZ	Pulpa de remolacha + zanahoria + banano + jugo de naranja	12000	\N	activo	inactivo	unidad	1749836396171.jpeg	2025-06-13 17:39:56.18391	2025-06-13 17:39:56.18391	181	27
327	VAMPIRO 16 ONZ	Pulpa de remolacha + zanahoria + banano + jugo de naranja	9500	\N	activo	inactivo	unidad	1749836441127.jpeg	2025-06-13 17:40:41.137629	2025-06-13 17:40:41.137629	181	27
328	VAMPIRO 12 ONZ	Pulpa de remolacha + zanahoria + banano + jugo de naranja	8000	\N	activo	inactivo	unidad	1749836480397.jpeg	2025-06-13 17:41:20.402171	2025-06-13 17:41:20.402171	181	27
329	CAFÉ LABOYANO 22 ONZ	Café laboyano + cocoa + leche + endulzante	12000	\N	activo	inactivo	unidad	1749836651018.jpeg	2025-06-13 17:44:11.030373	2025-06-13 17:44:11.030373	181	27
330	CAFÉ LABOYANO 16 ONZ	Café laboyano + cocoa + leche + endulzante	9500	\N	activo	inactivo	unidad	1749836690379.jpeg	2025-06-13 17:44:50.391219	2025-06-13 17:44:50.391219	181	27
331	CAFÉ LABOYANO 12 ONZ	Café laboyano + cocoa + leche + endulzante	8000	\N	activo	inactivo	unidad	1749836740934.jpeg	2025-06-13 17:45:40.946803	2025-06-13 17:45:40.946803	181	27
332	MIX AMARILLO 22 ONZ	Pulpa de durazno + limón + jugo de naranja	12000	\N	activo	inactivo	unidad	1749836981408.jpeg	2025-06-13 17:49:41.413282	2025-06-13 17:49:41.413282	181	27
333	MIX AMARILLO 16 ONZ	Pulpa de durazno + limón + jugo de naranja	9500	\N	activo	inactivo	unidad	1749837033862.jpeg	2025-06-13 17:50:33.874284	2025-06-13 17:50:33.874284	181	27
334	MIX AMARILLO 12 ONZ	Pulpa de durazno + limón + jugo de naranja	8000	\N	activo	inactivo	unidad	1749837082821.jpeg	2025-06-13 17:51:22.833801	2025-06-13 17:51:22.833801	181	27
335	LIMONADA DE COCO 22 ONZ	Pulpa de coco + leche de coco +jugo de limón + leche	13000	\N	activo	inactivo	unidad	1749837214337.jpeg	2025-06-13 17:53:34.348577	2025-06-13 17:53:34.348577	183	27
336	LIMONADA DE COCO 16 ONZ	Pulpa de coco + leche de coco +jugo de limón + leche	12000	\N	activo	inactivo	unidad	1749837251589.jpeg	2025-06-13 17:54:11.599833	2025-06-13 17:54:11.599833	183	27
337	LIMONADA DE COCO 12 ONZ	Pulpa de coco + leche de coco +jugo de limón + leche	11000	\N	activo	inactivo	unidad	1749837296990.jpeg	2025-06-13 17:54:56.994859	2025-06-13 17:54:56.994859	183	27
338	ENERGÍA EXTRA 22 ONZ	Pulpa de durazno + pulpa de sandia + jugo de naranja	12000	\N	activo	inactivo	unidad	1749837545584.jpeg	2025-06-13 17:59:05.595567	2025-06-13 17:59:05.595567	181	27
339	ENERGÍA EXTRA 16 ONZ	Pulpa de durazno + pulpa de sandia + jugo de naranja	9500	\N	activo	inactivo	unidad	1749837604953.jpeg	2025-06-13 18:00:04.968415	2025-06-13 18:00:04.968415	181	27
340	ENERGÍA EXTRA 12 ONZ	Pulpa de durazno + pulpa de sandia + jugo de naranja	8000	\N	activo	inactivo	unidad	1749837664301.jpeg	2025-06-13 18:01:04.311266	2025-06-13 18:01:04.311266	181	27
341	ROJO PASIÓN 22 ONZ	Pulpa de fresa + mango + yogur griego+ leche +miel	14000	\N	activo	inactivo	unidad	1749838334764.jpeg	2025-06-13 18:12:14.774602	2025-06-13 18:12:14.774602	180	27
342	ROJO PASIÓN 16 ONZ	Pulpa de fresa + mango + yogur griego+ leche +miel	12000	\N	activo	inactivo	unidad	1749838391435.jpeg	2025-06-13 18:13:11.444481	2025-06-13 18:13:11.444481	180	27
343	ROJO PASIÓN 12 ONZ	Pulpa de fresa + mango + yogur griego+ leche +miel	10000	\N	activo	inactivo	unidad	1749838435544.jpeg	2025-06-13 18:13:55.54918	2025-06-13 18:13:55.54918	180	27
283	MARACUMAN 12 ONZ	Pulpa de maracuyá + mango + yogur griego + leche + miel	10000	\N	activo	inactivo	unidad	1749830176400.jpeg	2025-06-13 15:56:16.409368	2025-06-13 15:56:16.409368	180	27
344	Combo Familiar	8 presas + papa a la francesa + arepa + ensalada de la casa + maduro + gaseosa 1.5	51000	\N	activo	inactivo	unidad	\N	2025-06-13 18:15:41.217806	2025-06-13 18:15:41.217806	229	34
345	Pollo asado	Papa arepa maduro	42000	\N	activo	inactivo	unidad	1749840845755.jpg	2025-06-13 18:54:05.765248	2025-06-13 18:54:05.765248	230	35
346	FORTE 22 ONZ	Pulpa de jengibre + mango + pera + jugo de naranja	11000	\N	activo	inactivo	unidad	1749840877691.jpeg	2025-06-13 18:54:37.70334	2025-06-13 18:54:37.70334	173	27
347	FORTE 16 ONZ	Pulpa de jengibre + mango + pera + jugo de naranja	9500	\N	activo	inactivo	unidad	1749840935937.jpeg	2025-06-13 18:55:35.947967	2025-06-13 18:55:35.947967	173	27
348	FORTE 12 ONZ	Pulpa de jengibre + mango + pera + jugo de naranja	9500	\N	activo	inactivo	unidad	1749840986191.jpeg	2025-06-13 18:56:26.201635	2025-06-13 18:56:26.201635	173	27
349	SUB ZERO 22 ONZ	Pulpa de banano+manzana verde+espinaca+jugo de naranja+limón	11000	\N	activo	inactivo	unidad	1749841254212.jpeg	2025-06-13 19:00:54.223355	2025-06-13 19:00:54.223355	173	27
350	SUB ZERO 16 ONZ	Pulpa de banano+manzana verde+espinaca+jugo de naranja+limón	9500	\N	activo	inactivo	unidad	1749841306217.jpeg	2025-06-13 19:01:46.222207	2025-06-13 19:01:46.222207	173	27
351	SUB ZERO 12 ONZ	Pulpa de banano+manzana verde+espinaca+jugo de naranja+limón	8000	\N	activo	inactivo	unidad	1749841341903.jpeg	2025-06-13 19:02:21.914869	2025-06-13 19:02:21.914869	173	27
352	SUCUS BLANCO 22 ONZ	Pulpa de guanabana+coco+banano+yogur griego+leche	14000	\N	activo	inactivo	unidad	1749843059359.jpeg	2025-06-13 19:30:59.366669	2025-06-13 19:30:59.366669	180	27
353	SUCUS BLANCO 16 ONZ	Pulpa de guanabana+coco+banano+yogur griego+leche	12000	\N	activo	inactivo	unidad	1749843133637.jpeg	2025-06-13 19:32:13.652055	2025-06-13 19:32:13.652055	180	27
354	churrasco	Corte de carne arepa yuca papa criolla	38000	\N	activo	inactivo	unidad	1749843322754.jpg	2025-06-13 19:35:22.757791	2025-06-13 19:35:22.757791	231	36
355	SUCUS BLANCO 12 ONZ	Pulpa de guanabana+coco+banano+yogur griego+leche	10000	\N	activo	inactivo	unidad	1749843655992.jpeg	2025-06-13 19:40:56.004475	2025-06-13 19:40:56.004475	180	27
356	SUCUS ESTELAR 22 ONZ	Pulpa de durazno+ fresa+yogur griego+leche	14000	\N	activo	inactivo	unidad	1749844011088.jpeg	2025-06-13 19:46:51.092502	2025-06-13 19:46:51.092502	180	27
357	Pollo	Papa arepa maduro	39000	\N	activo	inactivo	unidad	1749844042514.jpg	2025-06-13 19:47:22.526523	2025-06-13 19:47:22.526523	233	37
358	SUCUS ESTELAR 16 ONZ	Pulpa de durazno+ fresa+yogur griego+leche	12000	\N	activo	inactivo	unidad	1749844081574.jpeg	2025-06-13 19:48:01.579035	2025-06-13 19:48:01.579035	180	27
359	SUCUS ESTELAR 12 ONZ	Pulpa de durazno+ fresa+yogur griego+leche	10000	\N	activo	inactivo	unidad	1749844166955.jpeg	2025-06-13 19:49:26.968736	2025-06-13 19:49:26.968736	180	27
360	SUCUS AMARILLO 22 ONZ	Pulpa de maracuyá+coco+yogur griego+leche	14000	\N	activo	inactivo	unidad	1749845005588.jpeg	2025-06-13 20:03:25.59943	2025-06-13 20:03:25.59943	180	27
361	SUCUS AMARILLO 16 ONZ	Pulpa de maracuyá+coco+yogur griego+leche	12000	\N	activo	inactivo	unidad	1749845073505.jpeg	2025-06-13 20:04:33.510054	2025-06-13 20:04:33.510054	180	27
362	SUCUS AMARILLO 12 ONZ	Pulpa de maracuyá+coco+yogur griego+leche	10000	\N	activo	inactivo	unidad	1749845125866.jpeg	2025-06-13 20:05:25.869964	2025-06-13 20:05:25.869964	180	27
363	Churrasco	Papa la francesa + patacón + ensalada y chimichurri 	36000	\N	activo	inactivo	unidad	1749845489753.jpg	2025-06-13 20:11:29.765836	2025-06-13 20:11:29.765836	234	38
364	ZAMAN 22 ONZ	Pulpa de zanahoria+manzana verde+apio+limón+jugo de naranja	11000	\N	activo	inactivo	unidad	1749846275722.jpeg	2025-06-13 20:24:35.733351	2025-06-13 20:24:35.733351	173	27
365	ZAMAN 16 ONZ	Pulpa de zanahoria+manzana verde+apio+limón+jugo de naranja	9500	\N	activo	inactivo	unidad	1749846316881.jpeg	2025-06-13 20:25:16.89301	2025-06-13 20:25:16.89301	173	27
366	ZAMAN 12 ONZ	Pulpa de zanahoria+manzana verde+apio+limón+jugo de naranja	8000	\N	activo	inactivo	unidad	1749846356050.jpeg	2025-06-13 20:25:56.060907	2025-06-13 20:25:56.060907	173	27
367	VITAMINADA 22 ONZ	Pulpa de manzana verde+pera+kiwi+jugo de naranja+limón	11000	\N	activo	inactivo	unidad	1749846482700.jpeg	2025-06-13 20:28:02.711096	2025-06-13 20:28:02.711096	173	27
368	VITAMINADA 16 ONZ	Pulpa de manzana verde+pera+kiwi+jugo de naranja+limón	9500	\N	activo	inactivo	unidad	1749846520598.jpeg	2025-06-13 20:28:40.608987	2025-06-13 20:28:40.608987	173	27
369	VITAMINADA 12 ONZ	Pulpa de manzana verde+pera+kiwi+jugo de naranja+limón	8000	\N	activo	inactivo	unidad	1749846571198.jpeg	2025-06-13 20:29:31.212512	2025-06-13 20:29:31.212512	173	27
370	MORA GREEN 22 ONZ	Pulpa de remolacha+manzana verde+jugo de naranja+limón	11000	\N	activo	inactivo	unidad	1749846737132.jpeg	2025-06-13 20:32:17.138455	2025-06-13 20:32:17.138455	173	27
371	MORA GREEN 16 ONZ	Pulpa de remolacha+manzana verde+jugo de naranja+limón	9500	\N	activo	inactivo	unidad	1749846777489.jpeg	2025-06-13 20:32:57.499868	2025-06-13 20:32:57.499868	173	27
372	MORA GREEN 12 ONZ	Pulpa de remolacha+manzana verde+jugo de naranja+limón	8000	\N	activo	inactivo	unidad	1749846818706.jpeg	2025-06-13 20:33:38.717986	2025-06-13 20:33:38.717986	173	27
373	ENERGÍA PLUS 22 ONZ	Pulpa de banano+pera+piña+mango+agua	11000	\N	activo	inactivo	unidad	1749846938390.jpeg	2025-06-13 20:35:38.402411	2025-06-13 20:35:38.402411	173	27
374	ENERGÍA PLUS 16 ONZ	Pulpa de banano+pera+piña+mango+agua	9500	\N	activo	inactivo	unidad	1749846999498.jpeg	2025-06-13 20:36:39.5079	2025-06-13 20:36:39.5079	173	27
375	ENERGÍA PLUS 12 ONZ	Pulpa de banano+pera+piña+mango+agua	8000	\N	activo	inactivo	unidad	1749847042418.jpeg	2025-06-13 20:37:22.431264	2025-06-13 20:37:22.431264	173	27
376	COLON 22 ONZ	Pulpa de nopal+melón+piña+jugo de naranja	11000	\N	activo	inactivo	unidad	1749847138465.jpeg	2025-06-13 20:38:58.475072	2025-06-13 20:38:58.475072	173	27
377	COLON 16 ONZ	Pulpa de nopal+melón+piña+jugo de naranja	9500	\N	activo	inactivo	unidad	1749847178838.jpeg	2025-06-13 20:39:38.84847	2025-06-13 20:39:38.84847	173	27
378	COLON 12 ONZ	Pulpa de nopal+melón+piña+jugo de naranja	8000	\N	activo	inactivo	unidad	1749847211717.jpeg	2025-06-13 20:40:11.728189	2025-06-13 20:40:11.728189	173	27
388	LIMONADA DE MELÓN 22 ONZ	Pulpa de melón+agua+azúcar	12000	\N	activo	inactivo	unidad	1749851758234.jpeg	2025-06-13 21:55:58.25395	2025-06-13 21:55:58.25395	183	27
236	VITAMAX 22 ONZ	Pulpa de kiwi+limón+maracuyá+piña+jugo de naranja	11000	\N	activo	inactivo	unidad	1749847380174.jpeg	2025-06-12 23:24:46.70303	2025-06-12 23:24:46.70303	173	27
379	LIMONADA DE HIERBA BUENA 22 ONZ	Hierba buena+agua+limón+azúcar	12000	\N	activo	inactivo	unidad	1749851095136.jpeg	2025-06-13 21:44:55.146503	2025-06-13 21:44:55.146503	183	27
380	LIMONADA DE HIERBA BUENA 16 ONZ	Hierba buena+agua+limón+azúcar	11000	\N	activo	inactivo	unidad	1749851172055.jpeg	2025-06-13 21:46:12.067558	2025-06-13 21:46:12.067558	183	27
381	LIMONADA DE HIERBA BUENA 12 ONZ	Hierba buena+agua+limón+azúcar	10000	\N	activo	inactivo	unidad	1749851218901.jpeg	2025-06-13 21:46:58.913488	2025-06-13 21:46:58.913488	183	27
382	BLANCO MIX 22 ONZ	Pulpa de fresa+guanabana+yogur griego+leche	14000	\N	activo	inactivo	unidad	1749851337090.jpeg	2025-06-13 21:48:57.094993	2025-06-13 21:48:57.094993	180	27
383	BLANCO MIX 16 ONZ	Pulpa de fresa+guanabana+yogur griego+leche	12000	\N	activo	inactivo	unidad	1749851391058.jpeg	2025-06-13 21:49:51.068793	2025-06-13 21:49:51.068793	180	27
384	BLANCO MIX 12 ONZ	Pulpa de fresa+guanabana+yogur griego+leche	10000	\N	activo	inactivo	unidad	1749851441518.jpeg	2025-06-13 21:50:41.528282	2025-06-13 21:50:41.528282	180	27
385	LIMONADA DE MANGO BICHE 22 ONZ	Pulpa de mango biche+agua+limón+azúcar	12000	\N	activo	inactivo	unidad	1749851543677.jpeg	2025-06-13 21:52:23.681774	2025-06-13 21:52:23.681774	183	27
386	LIMONADA DE MANGO BICHE 16 ONZ	Pulpa de mango biche+agua+limón+azúcar	11000	\N	activo	inactivo	unidad	1749851596824.jpeg	2025-06-13 21:53:16.834726	2025-06-13 21:53:16.834726	183	27
387	LIMONADA DE MANGO BICHE 12 ONZ	Pulpa de mango biche+agua+limón+azúcar	10000	\N	activo	inactivo	unidad	1749851644887.jpeg	2025-06-13 21:54:04.896719	2025-06-13 21:54:04.896719	183	27
389	LIMONADA DE MELÓN 16 ONZ	Pulpa de melón+agua+azúcar	11000	\N	activo	inactivo	unidad	1749851800973.jpeg	2025-06-13 21:56:40.982396	2025-06-13 21:56:40.982396	183	27
390	LIMONADA DE MELÓN 12 ONZ	Pulpa de melón+agua+azúcar	10000	\N	activo	inactivo	unidad	1749851843039.jpeg	2025-06-13 21:57:23.049189	2025-06-13 21:57:23.049189	183	27
391	PURA VIDA 22 ONZ	Pulpa de maracuyá+pulpa de banano+jugo de naranja	12000	\N	activo	inactivo	unidad	1749851959037.jpeg	2025-06-13 21:59:19.051087	2025-06-13 21:59:19.051087	181	27
392	PURA VIDA 16 ONZ	Pulpa de maracuyá+pulpa de banano+jugo de naranja	9500	\N	activo	inactivo	unidad	1749852012009.jpeg	2025-06-13 22:00:12.014517	2025-06-13 22:00:12.014517	181	27
393	PURA VIDA 12 ONZ	Pulpa de maracuyá+pulpa de banano+jugo de naranja	8000	\N	activo	inactivo	unidad	1749852053710.jpeg	2025-06-13 22:00:53.722007	2025-06-13 22:00:53.722007	181	27
394	LIMONADA DE FRESA 22 ONZ	Pulpa de fresa+agua+limón+azúcar	13000	\N	activo	inactivo	unidad	1749852191572.jpeg	2025-06-13 22:03:11.585085	2025-06-13 22:03:11.585085	183	27
395	LIMONADA DE FRESA 16 ONZ	Pulpa de fresa+agua+limón+azúcar	12000	\N	activo	inactivo	unidad	1749852237730.jpeg	2025-06-13 22:03:57.734503	2025-06-13 22:03:57.734503	183	27
396	LIMONADA DE FRESA 12 ONZ	Pulpa de fresa+agua+limón+azúcar	11000	\N	activo	inactivo	unidad	1749852278065.jpeg	2025-06-13 22:04:38.075658	2025-06-13 22:04:38.075658	183	27
397	LIMONADA DE CEREZA 22 ONZ	Pulpa de cereza+agua+limón	13000	\N	activo	inactivo	unidad	1749852578973.jpeg	2025-06-13 22:09:38.984078	2025-06-13 22:09:38.984078	183	27
398	LIMONADA DE CEREZA 16 ONZ	Pulpa de cereza+agua+limón	12000	\N	activo	inactivo	unidad	1749852623663.jpeg	2025-06-13 22:10:23.673493	2025-06-13 22:10:23.673493	183	27
399	LIMONADA DE CEREZA 12 ONZ	Pulpa de cereza+agua+limón	11000	\N	activo	inactivo	unidad	1749852666381.jpeg	2025-06-13 22:11:06.395808	2025-06-13 22:11:06.395808	183	27
400	SUCUS NARANJA 22 ONZ	Pulpa de durazno+mango+maracuyá+yogur griego+leche	14000	\N	activo	inactivo	unidad	1749853523408.jpeg	2025-06-13 22:25:23.416381	2025-06-13 22:25:23.416381	180	27
401	SUCUS NARANJA 16 ONZ	Pulpa de durazno+mango+maracuyá+yogur griego+leche	12000	\N	activo	inactivo	unidad	1749853579559.jpeg	2025-06-13 22:26:19.563907	2025-06-13 22:26:19.563907	180	27
402	SUCUS NARANJA 12 ONZ	Pulpa de durazno+mango+maracuyá+yogur griego+leche	10000	\N	activo	inactivo	unidad	1749853632423.jpeg	2025-06-13 22:27:12.427747	2025-06-13 22:27:12.427747	180	27
403	Mandy XXL	Salchipapa Familiar Con Papas A La Francesa Carne Y Pollo Desmechado Salchichas Picadas,Chorizo, Longaniza, Tocineta Y Queso Gratinado Con Las mejores Salsas Alcanza Hasta Para 5 personas	50000	\N	activo	inactivo	unidad	1749854707595.jpg	2025-06-13 22:45:07.638876	2025-06-13 22:45:07.638876	237	39
405	Yumbo Mixta Xl	Alcanza Hasta Para 3 personas Viene Con papas A la francesa salchicha picada chorizo longaniza tocineta queso gratinado 	35000	\N	activo	inactivo	unidad	1749856406180.jpg	2025-06-13 23:13:26.230793	2025-06-13 23:13:26.230793	237	39
406	Yumbo Mixta 	Alcanza hasta para 2 personas trae papas a la francesa salchichas picadas chorizo longaniza tocineta huevo de codorniz y 2 chorizos cocteleros 	25000	\N	activo	inactivo	unidad	1749856520553.jpg	2025-06-13 23:15:07.133173	2025-06-13 23:15:07.133173	237	39
407	Menu	Lista De precios 	4000	\N	activo	inactivo	unidad	1749856547878.jpg	2025-06-13 23:15:47.888522	2025-06-13 23:15:47.888522	237	39
408	Conofrecer 	Fresas crema 2 toppngs 2 salsas	18500	\N	activo	inactivo	unidad	1749857227020.jpg	2025-06-13 23:27:07.024184	2025-06-13 23:27:07.024184	239	40
413	Arroz mixto personal	Pollo-cerdo-chorizo-costilla ahumada-verdura-arveja verde-maiz-maduro	13000	\N	activo	inactivo	unidad	1749859852644.jpg	2025-06-14 00:10:52.659565	2025-06-14 00:10:52.659565	218	33
412	Arroz de campo x10	Pollo-chorizo-costilla ahumada-albóndigas-chicharrón-frijol-maíz-verduras	63000	\N	activo	inactivo	unidad	1749859586247.jpg	2025-06-14 00:06:26.258671	2025-06-14 00:06:26.258671	221	33
411	Arroz de campo x6	Pollo-chorizo-costilla ahumada-albóndigas-chicharrón-frijol-maíz-verduras	50000	\N	activo	inactivo	unidad	1749859552393.jpg	2025-06-14 00:05:52.404001	2025-06-14 00:05:52.404001	221	33
410	Arroz de campo x4	Pollo-chorizo-costilla ahumada-albóndigas-chicharrón-frijol-maíz-verduras	40000	\N	activo	inactivo	unidad	1749859509763.jpg	2025-06-14 00:05:09.767779	2025-06-14 00:05:09.767779	221	33
409	Arroz de campo x3	Pollo-chorizo-costilla ahumada-albóndigas-chicharrón-frijol-maíz-verduras	30000	\N	activo	inactivo	unidad	1749859456431.jpg	2025-06-14 00:04:16.435724	2025-06-14 00:04:16.435724	221	33
404	Arroz de campo x2	Pollo-chorizo-costilla ahumada-albóndigas-chicharrón-frijol-maíz-verduras	23000	\N	activo	inactivo	unidad	1749855071913.jpg	2025-06-13 22:51:11.916385	2025-06-13 22:51:11.916385	221	33
325	Arroz de campo personal	Pollo-chorizo-costilla ahumada-albóndigas-chicharrón-frijol-maíz verduras	13000	\N	activo	inactivo	unidad	1749836190806.jpg	2025-06-13 17:36:30.809773	2025-06-13 17:36:30.809773	221	33
414	Arroz mixto x2	Pollo-cerdo-chorizo-costilla ahumada-verdura-arveja verde-maiz-maduro	23000	\N	activo	inactivo	unidad	1749860032516.jpg	2025-06-14 00:13:52.526334	2025-06-14 00:13:52.526334	218	33
415	Arepa de queso,tocineta y maíz 	Arepa de queso,tocineta y maíz 	5500	\N	activo	inactivo	unidad	1749860060198.jpg	2025-06-14 00:14:20.201678	2025-06-14 00:14:20.201678	240	41
416	Arroz mixto x3	Pollo-cerdo-chorizo-costilla ahumada-verdura-arveja verde-maiz-maduro	30000	\N	activo	inactivo	unidad	1749860065975.jpg	2025-06-14 00:14:25.978637	2025-06-14 00:14:25.978637	218	33
417	Arroz mixto x4	Pollo-cerdo-chorizo-costilla ahumada-verdura-arveja verde-maiz-maduro	40000	\N	activo	inactivo	unidad	1749860106734.jpg	2025-06-14 00:15:06.737975	2025-06-14 00:15:06.737975	218	33
418	Arroz mixto x6	Pollo-cerdo-chorizo-costilla ahumada-verdura-arveja verde-maiz-maduro	50000	\N	activo	inactivo	unidad	1749860186394.jpg	2025-06-14 00:16:26.404198	2025-06-14 00:16:26.404198	218	33
419	Arroz mixto x10	Pollo-cerdo-chorizo-costilla ahumada-verdura-arveja verde-maiz-maduro	63000	\N	activo	inactivo	unidad	1749860231452.jpg	2025-06-14 00:17:11.463855	2025-06-14 00:17:11.463855	218	33
420	Arroz chino personal	Pollo-cerdo-jamon-camarón-verdura-raiz	13000	\N	activo	inactivo	unidad	1749860366244.jpg	2025-06-14 00:19:26.256463	2025-06-14 00:19:26.256463	220	33
421	Arroz chino x2	Pollo-cerdo-jamon-camarón-verdura-raiz	23000	\N	activo	inactivo	unidad	1749860577197.jpg	2025-06-14 00:22:57.207546	2025-06-14 00:22:57.207546	220	33
422	Arroz chino x3	Pollo-cerdo-jamon-camarón-verdura-raiz	30000	\N	activo	inactivo	unidad	1749860615285.jpg	2025-06-14 00:23:35.295209	2025-06-14 00:23:35.295209	220	33
429	Combo P1	230 gramos de arroz thay o paisa, presa de pollo asado o broaster + papa arepa.	10500	\N	activo	inactivo	unidad	\N	2025-06-14 01:09:08.511451	2025-06-14 01:09:08.511451	192	29
423	Arroz chino x4	Pollo-cerdo-jamon-camarón-verdura-raiz	40000	\N	activo	inactivo	unidad	1749860777179.jpg	2025-06-14 00:26:17.191288	2025-06-14 00:26:17.191288	220	33
424	Arroz chino x6	Pollo-cerdo-jamon-camarón-verdura-raiz	50000	\N	activo	inactivo	unidad	1749861036266.jpg	2025-06-14 00:30:36.276981	2025-06-14 00:30:36.276981	220	33
425	Arroz chino x10	Pollo-cerdo-jamon-camarón-verdura-raiz	63000	\N	activo	inactivo	unidad	1749861062781.jpg	2025-06-14 00:31:02.791648	2025-06-14 00:31:02.791648	220	33
426	Arroz vegetariano perosnal	A base de 8 verduras 	13000	\N	activo	inactivo	unidad	1749861392929.jpg	2025-06-14 00:36:32.941307	2025-06-14 00:36:32.941307	222	33
427	Arroz vegetariano x2	A base de 8 verduras 	23000	\N	activo	inactivo	unidad	1749861778329.jpg	2025-06-14 00:42:58.339168	2025-06-14 00:42:58.339168	222	33
428	Arroz vegetariano x3	A base de 8 verduras 	30000	\N	activo	inactivo	unidad	1749861809652.jpg	2025-06-14 00:43:29.663838	2025-06-14 00:43:29.663838	222	33
430	Combo P3 	230 gramos de arroz thay o paisa, presa de pollo asado o broaster + papa francesa	11500	\N	activo	inactivo	unidad	\N	2025-06-14 01:10:22.987235	2025-06-14 01:10:22.987235	192	29
431	Tostada clasica	Tostadas tradicionales caramelizadas con azúcar, servidas con una generosa porción de miel de mapié y acompañadas de frutas frescas	19000	\N	activo	inactivo	unidad	1749863480985.jpg	2025-06-14 01:11:20.995806	2025-06-14 01:11:20.995806	243	42
433	Combo P4 papa francesa	230 gramos de arroz thay o paisa, 1/4 de pollo asado o broaster + papa francesa.	15000	\N	activo	inactivo	unidad	\N	2025-06-14 01:14:03.934823	2025-06-14 01:14:03.934823	195	29
432	Combo P4	230 gramos de arroz thay o paisa, 1/4 de pollo asado o broaster + papa, arepa y maduro.	14000	\N	activo	inactivo	unidad	\N	2025-06-14 01:11:28.617888	2025-06-14 01:11:28.617888	195	29
434	TOSTADA CHEESECAKE	Tostadas francesas rellenas de suave cheescake de fresas, servidas con una exquisita miel de maple y acompañada de frutos rojos frescos.	23000	\N	activo	inactivo	unidad	1749864620464.jpg	2025-06-14 01:30:20.468396	2025-06-14 01:30:20.468396	243	42
435	Hamburguesa con pan 	130gr res + cebolla + ripio + tomate + salsas+ pollo + salami + jamon	18000	\N	activo	inactivo	unidad	1749868654517.jpg	2025-06-14 02:37:34.527144	2025-06-14 02:37:34.527144	259	43
437	Milo frio	Milo frio	700	\N	activo	inactivo	unidad	1749873976606.jpg	2025-06-14 04:06:16.617365	2025-06-14 04:06:16.617365	270	7
438	Milo caliente 	Milo caliente 	5000	\N	activo	inactivo	unidad	1749874005348.jpg	2025-06-14 04:06:45.359778	2025-06-14 04:06:45.359778	270	7
439	Vaso jugo en leche	Vaso jugo en leche	7000	\N	activo	inactivo	unidad	1749874109812.jpg	2025-06-14 04:08:29.825437	2025-06-14 04:08:29.825437	270	7
440	Vaso jugo en agua	Vaso jugo en agua 	6000	\N	activo	inactivo	unidad	1749874141559.jpg	2025-06-14 04:09:01.578646	2025-06-14 04:09:01.578646	270	7
441	Jarra jugo en leche	Jarra 	13000	\N	activo	inactivo	unidad	1749874165282.jpg	2025-06-14 04:09:25.295974	2025-06-14 04:09:25.295974	270	7
442	Jarra jugo en agua 	Jarra jugo agua 	10000	\N	activo	inactivo	unidad	1749874198469.jpg	2025-06-14 04:09:58.481362	2025-06-14 04:09:58.481362	270	7
443	Productos Postobón coca-cola jugos naturales o café en leche	Bebidas 	3500	\N	activo	inactivo	unidad	1749874241879.jpg	2025-06-14 04:10:41.889201	2025-06-14 04:10:41.889201	270	7
446	Pizza hawaiana	Piña mortadela queso	8000	\N	activo	inactivo	unidad	1749874461747.jpg	2025-06-14 04:14:21.75707	2025-06-14 04:14:21.75707	33	7
447	Pizza pollo con champiñones	Pollo mortadela champiñones queso	8000	\N	activo	inactivo	unidad	1749874489145.jpg	2025-06-14 04:14:49.156545	2025-06-14 04:14:49.156545	33	7
448	Pizza de carnes	Carne pollo cerveroni salchichón de pollo mortadela cebolla pimentón queso	9000	\N	activo	inactivo	unidad	1749874525358.jpg	2025-06-14 04:15:25.368746	2025-06-14 04:15:25.368746	33	7
449	Pizza de la casa	Carne maíz tierno tocineta salsas barbacoa y queso	9000	\N	activo	inactivo	unidad	1749874688986.jpg	2025-06-14 04:18:08.997666	2025-06-14 04:18:08.997666	33	7
450	Hamburguesa con pan	Lechuga+ tomate +cebolla salteada +carne +queso +mortadela +tocineta y huevos de codorniz	13000	\N	activo	inactivo	unidad	1749874848778.jpg	2025-06-14 04:20:48.789131	2025-06-14 04:20:48.789131	34	7
451	Hamburguesa mixta	Lechuga+ tomate+ cebolla salteada+ carne+ pollo+ queso +mortadela+ tocineta y huevos de codorniz +porción de papas	20000	\N	activo	inactivo	unidad	1749874927695.jpg	2025-06-14 04:22:07.706588	2025-06-14 04:22:07.706588	34	7
452	Hamburguesa doble carne	Lechuga +tomate+ cebolla +salteada +queso+ doble carne +mortadela +tocineta+ huevos de codorniz +porción de papas	20000	\N	activo	inactivo	unidad	1749874997077.jpg	2025-06-14 04:23:17.086768	2025-06-14 04:23:17.086768	34	7
453	Hamburguesa con patacón	Patacón +salsas+ lechuga+ tomate+ carne +pollo +cebolla+ queso +mortadela +tocineta	15000	\N	activo	inactivo	unidad	1749875176868.jpg	2025-06-14 04:26:16.871543	2025-06-14 04:26:16.871543	34	7
454	Hamburguesa doble carne con patacón	Patacón +doble carne+ salsas +lechuga +tomate+ pollo+ cebolla+ queso+ mortadela+ tocineta	18000	\N	activo	inactivo	unidad	1749875246601.jpg	2025-06-14 04:27:26.6127	2025-06-14 04:27:26.6127	34	7
455	Arepa burger	Arepa +carne+ tomate +lechuga+ queso +salsa ahumada y tocineta+ huevos de codorniz	12000	\N	activo	inactivo	unidad	1749875429689.jpg	2025-06-14 04:30:29.693318	2025-06-14 04:30:29.693318	37	7
456	Hamburguesa pollo	Pan +pollo+ tomate +lechuga+ queso +salsas+ tocineta y huevos de codorniz	13000	\N	activo	inactivo	unidad	1749875526588.jpg	2025-06-14 04:32:06.598162	2025-06-14 04:32:06.598162	34	7
457	Mazorcada	Pollo +carne +chicharrón+ chorizo +maíz+ papa francesa +queso+ huevos de codorniz	20000	\N	activo	inactivo	unidad	1749875631414.jpg	2025-06-14 04:33:51.423847	2025-06-14 04:33:51.423847	36	7
458	Patacón con todo	Pollo más carne más chicharrón más chorizo más maíz más queso más huevos de codorniz	18000	\N	activo	inactivo	unidad	1749875723937.jpg	2025-06-14 04:35:23.949364	2025-06-14 04:35:23.949364	38	7
459	Sándwich mixto	Jamón más cordero más pollo más salsa de ajo más tomate mal salsa de piña más lechuga más mortadela y queso	11000	\N	activo	inactivo	unidad	1749876031777.jpg	2025-06-14 04:40:31.788279	2025-06-14 04:40:31.788279	39	7
460	Sándwich pollo	Pollo más salsa de ajo más salsa de piña más lechuga más tomate más mortadela más queso	10000	\N	activo	inactivo	unidad	1749876069987.jpg	2025-06-14 04:41:09.99806	2025-06-14 04:41:09.99806	39	7
461	Sándwish cordero	Cordero salsa de ajo salsa de piña lechuga tomate mortadela queso	10000	\N	activo	inactivo	unidad	1749876198546.jpg	2025-06-14 04:43:18.555593	2025-06-14 04:43:18.555593	39	7
462	Perro sencillo	Salchicha rica pollo desmechado ripio y salsas	10000	\N	activo	inactivo	unidad	1749876306002.png	2025-06-14 04:45:06.007891	2025-06-14 04:45:06.007891	40	7
463	Perro especial	Salchicha americana +cebolla +queso+ ripio +pollo+ huevos de codorniz y salsa tocineta	12000	\N	activo	inactivo	unidad	1749876378693.png	2025-06-14 04:46:18.70418	2025-06-14 04:46:18.70418	40	7
473	PROTEÍNA FRUTOS SECOS 22 ONZ	Albumina de huevo+leche entera o de almendras+almendras+pistachos+avellanas+avena	15000	\N	activo	inactivo	unidad	1749913624795.jpeg	2025-06-14 15:07:04.806159	2025-06-14 15:07:04.806159	174	27
444	Tinto	Tinto	2500	\N	activo	inactivo	unidad	1749876517271.jpg	2025-06-14 04:11:00.584556	2025-06-14 04:11:00.584556	270	7
445	Aromatica	Aromatica 	2000	\N	activo	inactivo	unidad	1749876606354.jpg	2025-06-14 04:11:24.341375	2025-06-14 04:11:24.341375	270	7
464	FUSIÓN MIX 22 ON	Pulpa de piña+papaya+coco+mango+jugo de naranja	13000	\N	activo	inactivo	unidad	1749912839426.jpeg	2025-06-14 14:53:59.437702	2025-06-14 14:53:59.437702	176	27
465	FUSIÓN MIX 16 ON	Pulpa de piña+papaya+coco+mango+jugo de naranja	11000	\N	activo	inactivo	unidad	1749912881822.jpeg	2025-06-14 14:54:41.832447	2025-06-14 14:54:41.832447	176	27
466	FUSIÓN MIX 12 ON	Pulpa de piña+papaya+coco+mango+jugo de naranja	9000	\N	activo	inactivo	unidad	1749912933013.jpeg	2025-06-14 14:55:33.016772	2025-06-14 14:55:33.016772	176	27
467	TAMARINDO 22 ONZ	Pulpa de tamarindo + leche/agua+azucar	13000	\N	activo	inactivo	unidad	1749913009218.jpeg	2025-06-14 14:56:49.227564	2025-06-14 14:56:49.227564	176	27
468	TAMARINDO 16 ONZ	Pulpa de tamarindo + leche/agua+azucar	11000	\N	activo	inactivo	unidad	1749913044214.jpeg	2025-06-14 14:57:24.225498	2025-06-14 14:57:24.225498	176	27
469	TAMARINDO 12 ONZ	Pulpa de tamarindo + leche/agua+azucar	9000	\N	activo	inactivo	unidad	1749913081008.jpeg	2025-06-14 14:58:01.019912	2025-06-14 14:58:01.019912	176	27
470	GUANABANAZO 22 ONZ	Pulpa de guanabana+leche+azucar	13000	\N	activo	inactivo	unidad	1749913255077.jpeg	2025-06-14 15:00:55.088848	2025-06-14 15:00:55.088848	176	27
471	GUANABANAZO 16 ONZ	Pulpa de guanabana+leche+azucar	11000	\N	activo	inactivo	unidad	1749913303411.jpeg	2025-06-14 15:01:43.423993	2025-06-14 15:01:43.423993	176	27
472	GUANABANAZO 12 ONZ	Pulpa de guanabana+leche+azucar	9000	\N	activo	inactivo	unidad	1749913373561.jpeg	2025-06-14 15:02:53.570682	2025-06-14 15:02:53.570682	176	27
474	PROTEÍNA FRUTOS SECOS 16 ONZ	Albumina de huevo+leche entera o de almendras+almendras+pistachos+avellanas+avena	14000	\N	activo	inactivo	unidad	1749913670390.jpeg	2025-06-14 15:07:50.400041	2025-06-14 15:07:50.400041	174	27
475	PROTEÍNA FRUTOS SECOS 12 ONZ	Albumina de huevo+leche entera o de almendras+almendras+pistachos+avellanas+avena	11000	\N	activo	inactivo	unidad	1749913722141.jpeg	2025-06-14 15:08:42.153994	2025-06-14 15:08:42.153994	174	27
436	HAMBURGUESA ESPECIAL DOBLE 	Pan artesanal+doble carne de hamburguesa +doble queso+ tomate +cebolla+ ripio y salsas de la casa bueno	13000	\N	activo	inactivo	unidad	1749870514599.jpg	2025-06-14 03:08:34.649486	2025-06-14 03:08:34.649486	263	44
477	PROTEÍNA AMAZÓNICA 16 ONZ	Pulpa de aguacate+banano+almendras+guaraná+leche+avena	14000	\N	activo	inactivo	unidad	1749914200694.jpeg	2025-06-14 15:16:40.704314	2025-06-14 15:16:40.704314	174	27
478	PROTEÍNA AMAZÓNICA 12 ONZ	Pulpa de aguacate+banano+almendras+guaraná+leche+avena	11000	\N	activo	inactivo	unidad	1749914251894.jpeg	2025-06-14 15:17:31.904238	2025-06-14 15:17:31.904238	174	27
476	PROTEÍNA AMAZÓNICA 22 ONZ	Pulpa de aguacate+banano+almendras+guaraná+leche+avena	15000	\N	activo	inactivo	unidad	1749914099741.jpeg	2025-06-14 15:14:59.753518	2025-06-14 15:14:59.753518	174	27
479	PROTEÍNA HULK 22 ONZ	Proteína wey+leche entera/almendras+maracuyá+apio	15000	\N	activo	inactivo	unidad	1749914373798.jpeg	2025-06-14 15:19:33.809232	2025-06-14 15:19:33.809232	174	27
480	PROTEÍNA HULK 16 ONZ	Proteína wey+leche entera/almendras+maracuyá+apio	14000	\N	activo	inactivo	unidad	1749914435362.jpeg	2025-06-14 15:20:35.374289	2025-06-14 15:20:35.374289	174	27
481	PROTEÍNA HULK 12 ONZ	Proteína wey+leche entera/almendras+maracuyá+apio	11000	\N	activo	inactivo	unidad	1749914530812.jpeg	2025-06-14 15:22:10.82528	2025-06-14 15:22:10.82528	174	27
482	CHOCO MIX 22 ONZ	Pulpa de banano+leche+cacao	13000	\N	activo	inactivo	unidad	1749914635739.jpeg	2025-06-14 15:23:55.750221	2025-06-14 15:23:55.750221	176	27
483	CHOCO MIX 16 ONZ	Pulpa de banano+leche+cacao	11000	\N	activo	inactivo	unidad	1749914742595.jpeg	2025-06-14 15:25:42.606338	2025-06-14 15:25:42.606338	176	27
484	CHOCO MIX 12 ONZ	Pulpa de banano+leche+cacao	9000	\N	activo	inactivo	unidad	\N	2025-06-14 15:27:06.206502	2025-06-14 15:27:06.206502	176	27
485	BOWL DE ACAI	Pulpa de acai+fresa+banano+piña+yogur	13500	\N	activo	inactivo	unidad	1749914936002.jpeg	2025-06-14 15:28:56.008247	2025-06-14 15:28:56.008247	175	27
486	CHOLUPA 22 ONZ	Pulpa de cholupa+leche+azucar	12500	\N	activo	inactivo	unidad	1749915038205.jpeg	2025-06-14 15:30:38.209411	2025-06-14 15:30:38.209411	176	27
487	CHOLUPA 16 ONZ	Pulpa de cholupa+leche+azucar	10000	\N	activo	inactivo	unidad	1749915118041.jpeg	2025-06-14 15:31:58.052909	2025-06-14 15:31:58.052909	176	27
488	CHOLUPA 12 ONZ	Pulpa de cholupa+leche+azucar	9000	\N	activo	inactivo	unidad	\N	2025-06-14 15:32:41.450088	2025-06-14 15:32:41.450088	176	27
489	Asado huilense	300 gr de carne + yuca +insultos+ arepa + yuca 	30000	\N	activo	inactivo	unidad	1749926289976.jpg	2025-06-14 18:38:09.987449	2025-06-14 18:38:09.987449	281	45
490	Juan valerios	Plátano maduro+carne +pollo+chicharrón+guacamole	7000	\N	activo	inactivo	unidad	1749926523405.jpg	2025-06-14 18:42:03.416835	2025-06-14 18:42:03.416835	282	45
491	RETARDANTES 	Prolonga el placer intimo del hombre 	47500	\N	activo	inactivo	unidad	1749930165246.jpg	2025-06-14 19:42:45.2902	2025-06-14 19:42:45.2902	286	46
492	Arroz vegetariano x4	A base de 8 verduras 	40000	\N	activo	inactivo	unidad	1749930231309.jpg	2025-06-14 19:43:51.312851	2025-06-14 19:43:51.312851	222	33
493	Arroz vegetariano x6	A base de 8 verduras 	50000	\N	activo	inactivo	unidad	1749930267638.jpg	2025-06-14 19:44:27.649493	2025-06-14 19:44:27.649493	222	33
494	Arroz vegetariano x10	A base de 8 verduras 	63000	\N	activo	inactivo	unidad	1749930298372.jpg	2025-06-14 19:44:58.38429	2025-06-14 19:44:58.38429	222	33
496	LUBRICANTE ÍNTIMO PEQUEÑO 	EFECTO CALIENTE, SABOR A MANZANA VERDE. A BASE DE AGUA 	0	\N	activo	inactivo	unidad	1749933099671.jpeg	2025-06-14 20:31:39.681753	2025-06-14 20:31:39.681753	284	46
495	LUBRICANTE INTIMO	EFECTO CALIENTE, APTO PARA SEXO ORAL SABOR A CHICLE 	44700	\N	activo	inactivo	unidad	1749933163351.jpeg	2025-06-14 20:17:32.434322	2025-06-14 20:17:32.434322	284	46
498	LUBRICANTE	EFECTO CALIENTE, SABOR A KIWI. A BASE DE AGUA 	0	\N	activo	inactivo	unidad	\N	2025-06-14 20:36:15.627865	2025-06-14 20:36:15.627865	284	46
500	Envuelta sencilla 	Tortilla de harina, queso, plátano maduro, carne de hamburguesa, cebolla, tomate, lechuga y salsa de la casa 	13000	\N	activo	inactivo	unidad	1749933774206.jpg	2025-06-14 20:42:54.218178	2025-06-14 20:42:54.218178	267	44
501	RETARDANTE PEQUEÑO 	PROLONGA EL PLACER ÍNTIMO DEL HOMBRE	0	\N	activo	inactivo	unidad	1749933790778.jpeg	2025-06-14 20:43:10.78219	2025-06-14 20:43:10.78219	286	46
497	Hamburguesa patacon sencilla 	Patacon, ripio,carne de hamburguesa, queso, cebolla, tomate, lechuga y salsa de la casa 	11000	\N	activo	inactivo	unidad	1749933328026.jpg	2025-06-14 20:35:28.076492	2025-06-14 20:35:28.076492	263	44
499	Hamburguesa en pan sencilla	Pan artesanal, ripio, carne de hamburguesa, queso, cebolla, tomate y salsa de la casa	9000	\N	activo	inactivo	unidad	1749933578100.jpg	2025-06-14 20:39:38.109978	2025-06-14 20:39:38.109978	263	44
502	Envuelta especial de cerdo y salchicha	Tortilla de harina, cerdo, salchicha, cebolla, tomate, lechuga y salsa de la casa 	16000	\N	activo	inactivo	unidad	1749934006053.jpg	2025-06-14 20:46:46.106857	2025-06-14 20:46:46.106857	267	44
503	Trucha kilo	Deshuesada	25000	\N	activo	inactivo	unidad	1749934177477.jpg	2025-06-14 20:49:37.488003	2025-06-14 20:49:37.488003	302	47
504	Envuelta mixta 	Tortilla de harina, queso, plátano maduro, carne de hamburguesa, tocineta, maíz, cerdo, salchicha, cebolla, tomate, lechuga y salsa de la casa 	20000	\N	activo	inactivo	unidad	1749934214597.jpg	2025-06-14 20:50:14.601225	2025-06-14 20:50:14.601225	267	44
505	Envuelta especial con carne de hamburguesa, tocineta y maíz 	Tortilla de harina, queso, plátano maduro, carne de hamburguesa, tocineta, maíz, cebolla, tomate, lechuga y salsa de la casa 	16000	\N	activo	inactivo	unidad	1749934414217.jpg	2025-06-14 20:53:34.226306	2025-06-14 20:53:34.226306	267	44
506	Mallas	Se ajustan a tu cuerpo 	76700	\N	activo	inactivo	unidad	1749934999402.jpeg	2025-06-14 21:03:19.413708	2025-06-14 21:03:19.413708	287	46
507	Malla enterizo	Se ajusta a tu cuerpo 	76700	\N	activo	inactivo	unidad	1749935061566.jpeg	2025-06-14 21:04:21.576198	2025-06-14 21:04:21.576198	287	46
508	COMBO BURGUER	Deliciosa hamburguesa de pollo +papas a la francesa + Gaseosa 	19900	\N	activo	inactivo	unidad	1750043428568.jpeg	2025-06-16 03:10:28.579524	2025-06-16 03:10:28.579524	304	48
510	COMBO X2	4 presas de pollo + 4 Arepas +papas a la francesa + 1 porción de croquetas de pollo +gaseosa personal	31900	\N	activo	inactivo	unidad	1750043883630.jpeg	2025-06-16 03:18:03.640318	2025-06-16 03:18:03.640318	305	48
511	COMBO MMM	1 pollo Broaster + gaseosas 1.5 + porciones de papas 	45900	\N	activo	inactivo	unidad	1750044118234.jpeg	2025-06-16 03:21:58.244576	2025-06-16 03:21:58.244576	305	48
512	COMBO CROQUETAS	Porción de croquetas + papas a la francesa + gaseosa personal 	16900	\N	activo	inactivo	unidad	1750044193520.jpeg	2025-06-16 03:23:13.525278	2025-06-16 03:23:13.525278	305	48
513	SÚPER MEGA COMBO	12 presas de pollo Broaster + 12 Arepas +2 porciones de papas a la francesa + 2 porciones de yuca + gaseosa 1.5	74900	\N	activo	inactivo	unidad	1750044292212.jpeg	2025-06-16 03:24:52.265625	2025-06-16 03:24:52.265625	305	48
515	1/2 POLLO BROASTER 	4 porciones de pollo Broaster + 4 Arepas 	20900	\N	activo	inactivo	unidad	1750044436906.jpeg	2025-06-16 03:27:16.916593	2025-06-16 03:27:16.916593	305	48
516	1/4 POLLO BROASTER	2 porciones de pollo Broaster + 2 Arepas 	10900	\N	activo	inactivo	unidad	1750044489234.jpeg	2025-06-16 03:28:09.23757	2025-06-16 03:28:09.23757	305	48
517	COMBO FAMILIAR 	8 presas de pollo + 8 Arepas + papa a la francesa + plátano maduro + ensalada + gaseosa 1.5 	51900	\N	activo	inactivo	unidad	1750044802263.jpeg	2025-06-16 03:33:22.274034	2025-06-16 03:33:22.274034	305	48
514	POLLO BROASTER 	8 presas + 8 Arepas + porción de ensalada 	38900	\N	activo	inactivo	unidad	1750044388881.jpeg	2025-06-16 03:26:28.89523	2025-06-16 03:26:28.89523	305	48
518	MEGA COMBO	10 presas de pollo + 10 Arepas + papas a la francesa + croquetas + gaseosa 1.5	59900	\N	activo	inactivo	unidad	1750044912352.jpeg	2025-06-16 03:35:12.363818	2025-06-16 03:35:12.363818	305	48
519	BANDEJA SENCILLA 	2 presas de pollo + arroz + ensalada + maduro 	15500	\N	activo	inactivo	unidad	1750045021410.jpeg	2025-06-16 03:37:01.423379	2025-06-16 03:37:01.423379	306	48
520	BANDEJA ESPECIAL 	2 presas de pollo+ frijoles + maduro + ensalada + limonada	17000	\N	activo	inactivo	unidad	1750045106609.jpeg	2025-06-16 03:38:26.620068	2025-06-16 03:38:26.620068	306	48
521	COMBO MÍO 	2 presas de pollo + 2 Arepas + papas a la francesa + croquetas + gaseosa personal 	23900	\N	activo	inactivo	unidad	1750045292672.jpeg	2025-06-16 03:41:32.675842	2025-06-16 03:41:32.675842	305	48
509	CROKAN COMBO 	10 presas de pollo Broaster + 10 Arepas + papas a la francesa + plátano maduro + ensalada + gaseosa 1.5	60900	\N	activo	inactivo	unidad	1750043616376.jpeg	2025-06-16 03:13:36.387847	2025-06-16 03:13:36.387847	305	48
558	LULADA 22 ONZ	Pulpa de lulo+leche/agua+miel	13000	\N	activo	inactivo	unidad	1750089087206.avif	2025-06-16 15:51:27.209333	2025-06-16 15:51:27.209333	176	27
522	1 Pollo BROASTER 	8 Presas + Papa a la Francesa + 6 Arepas + Ensalada de la Casa.	44000	\N	activo	inactivo	unidad	1750050550276.jpeg	2025-06-16 05:04:20.467061	2025-06-16 05:04:20.467061	229	34
535	BOROJAZO 22 ONZ	Pulpa de Borojó+tamarindo+leche+miel	13000	\N	activo	inactivo	unidad	1750087797813.jpg	2025-06-16 15:29:57.818702	2025-06-16 15:29:57.818702	176	27
536	BOROJAZO 16 ONZ	Pulpa de Borojó+tamarindo+leche+miel	11000	\N	activo	inactivo	unidad	1750087831478.jpg	2025-06-16 15:30:31.489824	2025-06-16 15:30:31.489824	176	27
537	BOROJAZO 12 ONZ	Pulpa de Borojó+tamarindo+leche+miel	9000	\N	activo	inactivo	unidad	1750087863984.jpg	2025-06-16 15:31:03.988778	2025-06-16 15:31:03.988778	176	27
524	273	Tonos ● Frutal ● Amaderado	13000	\N	activo	inactivo	unidad	\N	2025-06-16 15:05:59.190016	2025-06-16 15:05:59.190016	309	49
539	COPOAZÚ 22 ONZ	Pulpa de copoazú+leche+miel	15000	\N	activo	inactivo	unidad	1750088070184.jpeg	2025-06-16 15:34:30.190456	2025-06-16 15:34:30.190456	179	27
540	COPOAZÚ 16 ONZ	Pulpa de copoazú+leche+miel	14000	\N	activo	inactivo	unidad	1750088106378.jpeg	2025-06-16 15:35:06.381894	2025-06-16 15:35:06.381894	179	27
541	Papa francesa	250gr	5000	\N	activo	inactivo	unidad	\N	2025-06-16 15:35:38.814975	2025-06-16 15:35:38.814975	84	2
542	COPOAZÚ 12 ONZ	Pulpa de copoazú+leche+miel	10500	\N	activo	inactivo	unidad	1750088144113.jpeg	2025-06-16 15:35:44.116691	2025-06-16 15:35:44.116691	179	27
543	Tocineta	Por 3	5000	\N	activo	inactivo	unidad	\N	2025-06-16 15:35:58.798135	2025-06-16 15:35:58.798135	84	2
544	Papa criolla	200gr	5000	\N	activo	inactivo	unidad	\N	2025-06-16 15:36:15.810582	2025-06-16 15:36:15.810582	84	2
545	Huevo frito	1 unidad	2000	\N	activo	inactivo	unidad	\N	2025-06-16 15:36:32.816538	2025-06-16 15:36:32.816538	84	2
546	Carne o pollo	200gr	6000	\N	activo	inactivo	unidad	\N	2025-06-16 15:36:54.823354	2025-06-16 15:36:54.823354	84	2
547	Queso	Por 2 	5000	\N	activo	inactivo	unidad	\N	2025-06-16 15:37:12.79924	2025-06-16 15:37:12.79924	84	2
548	COCONA 22 ONZ	Pulpa de cocona+leche+miel	15000	\N	activo	inactivo	unidad	1750088238435.jpeg	2025-06-16 15:37:18.438733	2025-06-16 15:37:18.438733	179	27
549	Huevos de codorniz 	Por 10 unidades 	5000	\N	activo	inactivo	unidad	\N	2025-06-16 15:37:35.745334	2025-06-16 15:37:35.745334	84	2
550	COCONA 16 ONZ	Pulpa de cocona+leche+miel	14000	\N	activo	inactivo	unidad	1750088275811.jpeg	2025-06-16 15:37:55.82182	2025-06-16 15:37:55.82182	179	27
551	COCONA 12 ONZ	Pulpa de cocona+leche+miel	10500	\N	activo	inactivo	unidad	1750088305788.jpeg	2025-06-16 15:38:25.790962	2025-06-16 15:38:25.790962	179	27
552	ARAZÁ 22 ONZ	Pulpa de arazá+leche+miel	15000	\N	activo	inactivo	unidad	1750088485922.webp	2025-06-16 15:41:25.932925	2025-06-16 15:41:25.932925	179	27
553	ARAZÁ 16 ONZ	Pulpa de arazá+leche+miel	14000	\N	activo	inactivo	unidad	1750088517953.webp	2025-06-16 15:41:57.956841	2025-06-16 15:41:57.956841	179	27
554	ARAZÁ 12 ONZ	Pulpa de arazá+leche+miel	10500	\N	activo	inactivo	unidad	1750088555124.webp	2025-06-16 15:42:35.138987	2025-06-16 15:42:35.138987	179	27
555	ARRECHÓN 22 ONZ	Pulpa de chontaduro+pulpa de borojó+ron de coco+especias+miel	15000	\N	activo	inactivo	unidad	1750088786104.jpeg	2025-06-16 15:46:26.11645	2025-06-16 15:46:26.11645	179	27
556	ARRECHÓN 16 ONZ	Pulpa de chontaduro+pulpa de borojó+ron de coco+especias+miel	14000	\N	activo	inactivo	unidad	1750088829709.jpeg	2025-06-16 15:47:09.720043	2025-06-16 15:47:09.720043	179	27
557	ARRECHÓN 12 ONZ	Pulpa de chontaduro+pulpa de borojó+ron de coco+especias+miel	11000	\N	activo	inactivo	unidad	1750088859974.jpeg	2025-06-16 15:47:39.977578	2025-06-16 15:47:39.977578	179	27
562	ACAI 16 ONZ	Pulpa de acai+fresa/banano+leche+miel	14000	\N	activo	inactivo	unidad	1750091162817.jpeg	2025-06-16 16:26:02.867629	2025-06-16 16:26:02.867629	179	27
525	360	Tonos ● Amaderado ● Floral ● Fresco 	13000	\N	activo	inactivo	unidad	\N	2025-06-16 15:06:51.751019	2025-06-16 15:06:51.751019	310	49
526	360 Coral 	Tonos ● Frutal ●Floral●Cítrico 	13000	\N	activo	inactivo	unidad	\N	2025-06-16 15:08:11.483364	2025-06-16 15:08:11.483364	310	49
538	Cherry In Japan  	Tonos ● Floral ● Atalcado ● frutal	13000	\N	activo	inactivo	unidad	\N	2025-06-16 15:32:58.118728	2025-06-16 15:32:58.118728	311	49
534	Celos	Tonos ● Frutal ● Floral	13000	\N	activo	inactivo	unidad	\N	2025-06-16 15:26:36.230305	2025-06-16 15:26:36.230305	316	49
533	Carolina Herrera	Tonos ● Amaderado ● Floral ● Atalcado	13000	\N	activo	inactivo	unidad	\N	2025-06-16 15:16:29.810043	2025-06-16 15:16:29.810043	308	49
532	CAN CAN 	Tonos ● Atalcado ● Floral ● Cítrico ●Amaderado ●frutal	13000	\N	activo	inactivo	unidad	\N	2025-06-16 15:15:46.070825	2025-06-16 15:15:46.070825	314	49
530	BRIGHT CRYSTAL	Tonos ● Floral ● Cítrico ● Amaderado	13000	\N	activo	inactivo	unidad	\N	2025-06-16 15:13:14.08565	2025-06-16 15:13:14.08565	334	49
531	BURBERRY LONDON	Tonos ● Floral ● Frutal● Cítrico 	13000	\N	activo	inactivo	unidad	\N	2025-06-16 15:14:36.428155	2025-06-16 15:14:36.428155	313	49
523	212 Vip Rose 	Tiene tonos: ● Frutal  ● Floral ● Amaderado 	13000	\N	activo	inactivo	unidad	1750089983285.jpg	2025-06-16 15:05:13.736978	2025-06-16 15:05:13.736978	308	49
529	KIM KARDASHAN	Tonos ● Frutal ● Amaderado	13000	\N	activo	inactivo	unidad	\N	2025-06-16 15:10:09.996489	2025-06-16 15:10:09.996489	312	49
559	LULADA 16 ONZ	Pulpa de lulo+leche/agua+miel	11000	\N	activo	inactivo	unidad	1750089223509.avif	2025-06-16 15:53:43.518631	2025-06-16 15:53:43.518631	176	27
527	360 Rose 	Tonos ● Cítrico ● Floral 	13000	\N	activo	inactivo	unidad	\N	2025-06-16 15:08:49.457016	2025-06-16 15:08:49.457016	310	49
528	Agua Del sol 	Tonos ● Frutal ● cítrico ● Floral	13000	\N	activo	inactivo	unidad	\N	2025-06-16 15:09:39.74601	2025-06-16 15:09:39.74601	311	49
560	LULADA 12 ONZ	Pulpa de lulo+leche/agua+miel	9000	\N	activo	inactivo	unidad	1750089272210.avif	2025-06-16 15:54:32.219921	2025-06-16 15:54:32.219921	176	27
561	ACAI 22 ONZ	Pulpa de acai+fresa/banano+leche+miel	15000	\N	activo	inactivo	unidad	1750091127123.jpeg	2025-06-16 16:25:27.1765	2025-06-16 16:25:27.1765	179	27
563	ACAI 12 ONZ	Pulpa de acai+fresa/banano+leche+miel	11000	\N	activo	inactivo	unidad	1750091196195.jpeg	2025-06-16 16:26:36.245522	2025-06-16 16:26:36.245522	179	27
564	BOWL DE DURAZNO	Pulpa de durazno+fresa+yogur	13500	\N	activo	inactivo	unidad	\N	2025-06-16 16:27:48.02772	2025-06-16 16:27:48.02772	175	27
565	ENSALADA DE FRUTAS 22 ONZ	Yogur griego+fresa+banano+pera+uva chilena+kiwi+melocotón	15000	\N	activo	inactivo	unidad	1750091818352.jpeg	2025-06-16 16:36:58.405105	2025-06-16 16:36:58.405105	177	27
566	ENSALADA DE FRUTAS 16 ONZ	Yogur griego+fresa+banano+pera+uva chilena+kiwi+melocotón	12000	\N	activo	inactivo	unidad	1750091853149.jpeg	2025-06-16 16:37:33.200337	2025-06-16 16:37:33.200337	177	27
567	ENSALADA DE FRUTAS 12 ONZ	Yogur griego+fresa+banano+pera+uva chilena+kiwi+melocotón	10000	\N	activo	inactivo	unidad	1750091895369.jpeg	2025-06-16 16:38:15.420072	2025-06-16 16:38:15.420072	177	27
568	Pollo	Papa➕arepa➕maduro➕ acompañante 	42000	\N	activo	inactivo	unidad	1750105964362.jpg	2025-06-16 20:32:44.375116	2025-06-16 20:32:44.375116	337	50
569	J-1000	POTENCIALIZADOR NATURAL, INCREMENTA TU POTENCIA SEXUAL	67200	\N	activo	inactivo	unidad	1750115602998.jpeg	2025-06-16 23:13:23.009312	2025-06-16 23:13:23.009312	289	46
570	VOLUMINIZANTE 	INCREMENTA EL TAMAÑO DEL MIEMBRO	95800	\N	activo	inactivo	unidad	1750115930456.jpeg	2025-06-16 23:18:50.465528	2025-06-16 23:18:50.465528	339	46
571	ESTRECHANTE VAGINAL	CONTRAE LA PARED VAGINAL PARA DAR UN EFECTO TENSOR EN LA ZONA INTIMA	39800	\N	activo	inactivo	unidad	1750116059910.jpeg	2025-06-16 23:20:59.921813	2025-06-16 23:20:59.921813	295	46
572	LUBRICANTE ANAL	DILATA Y LUBRICA LA ZONA PARA DISMINUIR DOLOR O INCOMODIDAD. AROMA A CEREZA	41700	\N	activo	inactivo	unidad	\N	2025-06-16 23:27:28.429694	2025-06-16 23:27:28.429694	340	46
573	DILATADOR 	CREMA QUE DILATA 	36700	\N	activo	inactivo	unidad	1750116533003.jpeg	2025-06-16 23:28:53.016352	2025-06-16 23:28:53.016352	340	46
574	ACEITE PARA MASAJES 	EFECTO CALIENTE CON AROMA DELICIOSO 	54700	\N	activo	inactivo	unidad	1750116924836.jpeg	2025-06-16 23:35:24.847231	2025-06-16 23:35:24.847231	298	46
575	ACEITE PARA MASAJES 	EFECTO CALIENTE, AROMA COCO TROPICAL 	45700	\N	activo	inactivo	unidad	1750117063956.jpeg	2025-06-16 23:37:43.965381	2025-06-16 23:37:43.965381	298	46
576	ACEITE PARA MASAJES 	EFECTO CALIENTE, DELICIOSO OLOR A UVA	45700	\N	activo	inactivo	unidad	1750117175476.jpeg	2025-06-16 23:39:35.48601	2025-06-16 23:39:35.48601	298	46
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, nombre, fecha_creacion, fecha_actualizacion) FROM stdin;
1	administrador	2025-06-07 01:59:57.14018	2025-06-07 01:59:57.14018
2	aliado	2025-06-07 01:59:57.142147	2025-06-07 01:59:57.142147
\.


--
-- Data for Name: servicios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.servicios (id, nombre, estado, icon, color, orden, foto, fecha_creacion, fecha_actualizacion) FROM stdin;
2	Detalles	activo	FaGift	#00C950	8	det.png	2025-06-07 01:59:57.122815	2025-06-07 01:59:57.122815
3	Droguerías	activo	FaPills	#F0B100	6	dro.png	2025-06-07 01:59:57.124693	2025-06-07 01:59:57.124693
4	Almacenes	activo	FaWarehouse	#AD46FF	7	alm.png	2025-06-07 01:59:57.126478	2025-06-07 01:59:57.126478
5	Licores	activo	FaGlassCheers	#009966	9	lic.png	2025-06-07 01:59:57.128285	2025-06-07 01:59:57.128285
6	Recogidas	inactivo	FaTruck	#FB2C36	1	rec.png	2025-06-07 01:59:57.130146	2025-06-07 01:59:57.130146
7	Compras	inactivo	FaShoppingCart	#FF6900	2	com.png	2025-06-07 01:59:57.132923	2025-06-07 01:59:57.132923
1	Restaurantes	activo	FaUtensils	#2B7FFF	3	res.png	2025-06-07 01:59:57.119857	2025-06-07 01:59:57.119857
8	Pagos	inactivo	FaCreditCard	#615FFF	4	pag.png	2025-06-07 01:59:57.135876	2025-06-07 01:59:57.135876
9	Envíos	inactivo	FaParachuteBox	#00BBA7	5	env.png	2025-06-07 01:59:57.138024	2025-06-07 01:59:57.138024
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.usuarios (id, nombre, email, password, rol, estado, telefono, direccion, fecha_creacion, fecha_actualizacion, comercio_id) FROM stdin;
1	Admin	admin@domi.com	$2b$10$ykMXw/J2pQyguHNh4xHfUutgsYP2LrAP5xJVDzZTNWrUuiNoZModq	administrador	activo	\N	\N	2025-06-09 20:30:51.884911	2025-06-09 20:30:51.884911	\N
2	Aliado	aliado@domi.com	$2b$10$r0b6d5891nmEHqYo83RyHO97xnuOJ36VRL/HQeqJ0FM9V9hU9JLUe	aliado	activo	\N	\N	2025-06-09 20:30:51.963545	2025-06-09 20:30:51.963545	\N
3	Pekas pizza	pekaspizza777@gmail.com	$2b$10$UdSRHmWIWFX3NaSJP5vwWevLdhTIZ9NYbWpMtRg6pP/Czh8MpKI8W	aliado	activo	3138559008	Carrera 1#14-07 andes	2025-06-09 21:30:28.71287	2025-06-09 21:33:45.526082	1
4	Pac food	bahamonyuli@gmail.com	$2b$10$FSkgMjOt7xkg3Iwvkjg6vuNZd7SK5LJmSZahFk0.ZkkKDvAocbRkG	aliado	activo	3146313398	Carrera 1 # 13-58 cambulos	2025-06-10 02:04:56.629085	2025-06-10 02:10:33.073918	2
5	El Parche 	nanatorres1126@gmail.com	$2b$10$aJhptglk2VZeulFXZ250HuzMID9lAZv5gxH/KoK13o1CNFem3cvI2	aliado	activo	3203133646	Calle 13 # 1a -16 andes 	2025-06-10 21:21:29.79048	2025-06-10 21:26:50.979959	4
6	Mamut	mamutpena@gmail.com	$2b$10$VGtsz/f9fFIZx48RfneBAuRheimSwUZh/1xQ88MQNd9n.NtjieY5K	aliado	activo	3103451052	Carrera 7#10-28 sucre	2025-06-11 02:53:50.482367	2025-06-11 02:55:32.475184	5
7	Briochet	luisiibarra91@gmail.com	$2b$10$sqIrlZ03TaDE/OnEZJCib.fjVetIvDm3afi8oXsuY/Zok/OITaBOa	aliado	activo	3144537373	Carra 6 este # 15 a 36 sur 	2025-06-11 03:50:00.110342	2025-06-11 03:54:23.371107	6
9	San Diego restaurante 	restaurantesandiegodepitalito@gmail.com	$2b$10$oyDBqTpi5XyhUfHxm6MVwuimgn4eZ6Aepf59w03.8gR7uSIIXimHi	aliado	activo	3124617568	Carr 5#3-42 centro 	2025-06-11 14:43:54.00066	2025-06-11 15:23:43.807103	8
10	Charcuteria	esmeraldacharcuteria@gmail.com	$2b$10$bRDd/e6IJZdV83T6Pn63COh9dnQVewXxhwByVPcOyMh3wEwnWNRjC	aliado	activo	3208793279	Carr 5#3-46 centro 	2025-06-11 15:19:27.12402	2025-06-11 15:25:23.397643	9
11	Mi tierra 	restaurantemitierraamada@gmail.com	$2b$10$WFnWZr65T9KdIl8r3rYZlufcam10YAq5FcEujwExxL6pX6xFMZDPG	aliado	activo	3103317330	Carrera 1 # 3-11 quinche	2025-06-11 17:05:23.470651	2025-06-11 17:07:24.184617	10
12	Taiwan 	restaurantetaiwan12@gmail.com	$2b$10$tZqqpFN8r3aYnpJTP/6B1etJsgJIwQV.te0qPuaA7/ZCPmCEFtt06	aliado	activo	3132065482	Calle 4#3-38 centro 	2025-06-11 17:42:34.573435	2025-06-11 17:43:19.926536	11
13	Papa ala lavoyana 	carocape2001@gmail.com	$2b$10$f.VnvPFsjzqh/667PEFqU.JTunEBd2IpC9XrlUtuWw7MeS4KpRTj6	aliado	activo	3143017129	Carrera quinta este 3 a 11 Sur nogales	2025-06-11 21:09:15.302045	2025-06-11 21:09:58.507419	12
14	Deli fas food 	juan.toromesa@hotmail.com	$2b$10$YE1C5QtW/menfSw3vGOdTeYdFNYJoOAffo7aijnMtMaq3kwfjz4W6	aliado	activo	3105291443	Transversal 5 este 15a sur 57 villa cafe	2025-06-11 22:25:17.366082	2025-06-11 22:26:39.605766	13
15	Licet	santaalita.co@gmail.com	$2b$10$IQTOyzs7X/2tkvjacWAAx.HiFm2ZzBhdeBcWBsRz/SN5ZD2SBApF2	aliado	activo	3133060669	Calle 14 2- 58 	2025-06-11 23:12:12.149664	2025-06-11 23:12:39.550495	14
20	Jacqueline	jacquelinebeltranmunoz@gmail.com	$2b$10$QQG7gIpICIe3wIYW5V97kOj/7bU6FxWWqlz8F.27Gbti8shakqCPO	aliado	activo	3133902905	Carr 3#3-02 centro 	2025-06-12 05:32:09.550386	2025-06-12 05:32:32.295699	19
16	Kike	enrriquevelacarbajal6@gmail.com	$2b$10$lxuPFP698lM3DRziJMZnaukf8qRGu6e9Cog4ryv7csGgZR09ypQnW	aliado	activo	3138783907	Carr 1 # 23 - 14 sur madelena 	2025-06-11 23:45:49.812811	2025-06-11 23:59:56.064422	15
17	Tu salud plus	yessicacla14@gmail.com	$2b$10$IZ1USR20Evx4pnSwn6LiN.cOrjCFrotsqwGhwUMMXI8iIw3yJQMFu	aliado	activo	3203539292	Carrera 1 18-59 	2025-06-12 01:21:11.630442	2025-06-12 01:21:46.394444	16
18	Exotico 	exoticodina@gmail.com	$2b$10$Vb11Xm8v.C0pdan0n3IwA.E/ETuthiYdKOSd/MJGRD5LnqMEdEm4m	aliado	activo	3214586892	Carrera 1 # 18-80 portal del norte 	2025-06-12 02:02:16.311889	2025-06-12 02:02:41.789241	17
19	Ruby Beltrán 	beltranruby75@gmail.com	$2b$10$yBwmLi/dkq8cwawfcFIkROD5fXVS.t5Oo6fhdRBJ0QptDWIm/Vofq	aliado	activo	3165322883	Carrera 3#5-02 centro 	2025-06-12 03:40:14.34287	2025-06-12 03:41:40.227077	18
21	Pizza Express	soylaboyano@gmail.com	$2b$10$FuNm6tWgZEmC9CzNtPvHf.gqPaKdU6vqaRit.LMHP86CC7qctucMu	aliado	activo	3132030835	Calle 2 1a 62 quinche	2025-06-12 14:45:29.137013	2025-06-12 14:48:30.832787	21
27	Pizza express lagos	soylaboyano12@gmail.com	$2b$10$wut.VquYMOtz7RSMM8XnVeWgTgdixoJ60SX1j8cqFLFl5S2wEBIT2	aliado	activo	3134026973	Carr 1#2-112	2025-06-12 14:53:28.83567	2025-06-12 14:54:56.414862	20
28	Droguería y pañalera pitalito 	jonysalsa2008@hotmail.es	$2b$10$UhxkKcPIB1q78OmkTnrW6uuTQEuCErmyI6.c0obl.BfUl0P82OI7O	aliado	activo	3115565113	Carrera 1b # 3-03 quinche	2025-06-12 15:36:45.852928	2025-06-12 15:37:30.85884	22
29	Shangay 	dewangzheng@hotmail.como	$2b$10$KJobr8eMb.1nxuJpXl2x..Y95a2JE560CkS9ukdYsPB26/PWhy9rC	aliado	activo	3115782000	Carrera 4#6-20 centro 	2025-06-12 16:45:21.598891	2025-06-12 16:46:38.288557	23
30	Alejandro Vargas 	maurosanchezvargas@gmail.com	$2b$10$ahXp.gX4GcPoh75P/CTNsOKFi4DdqldwrJ6NVtNbp.Cdd62fvsyKu	aliado	activo	3207443658	Carrera 15 # 19b-09 sur siglo 21	2025-06-12 17:39:49.435988	2025-06-12 17:40:12.143747	24
31	Sandra 	sandritaramirez03@hotmail.com	$2b$10$YD81DfI8FVYPqBZKoE0Efeci4pO.PLXDfujL4sQ063OJf8g9q2uqO	aliado	activo	3203823144	Carrera 1bis 15 sur manzanres 	2025-06-12 21:43:29.891436	2025-06-12 21:52:58.696011	25
32	Vainilla	bermeogladys36@gmail.com	$2b$10$TuszeR4H.QxHlP4U5hMXnO2xrmDsLmQ.x.REsz8FNvCdpvDh602LC	aliado	activo	314 5299125	Calle 2 # 1b -23 quinche	2025-06-12 22:30:28.133781	2025-06-12 22:31:00.92675	26
33	Sucus	nativospitalito@gmail.com	$2b$10$VBKEVrnIGZwXY/6PnDQQ2eDEouqqkTq5vM/X6hG7sC79qs2LjCgZq	aliado	activo	3158751974	Calle 2 #1a 71 quinche	2025-06-12 23:15:26.451225	2025-06-12 23:15:47.076247	27
36	Don chicharrón 	jhon1150@hotmail.com	$2b$10$QHwusCTwZoI3HJvHaL9Kuu2k8/LUY/If5KrP28iOxuBG54HoPtaQa	aliado	activo	3204212406	Calle 2 # 1a-14 quinche	2025-06-13 02:03:58.080649	2025-06-13 02:04:26.004084	30
34	Arepazo	diegoachury510@hotmail.com	$2b$10$HdbDqmBKnDlX.w0I9bxLzetm.MMuQdXAZLL6desQe8jvll4YnIXNi	aliado	activo	3143923151	Carrera 4#2-91centro	2025-06-13 00:03:36.423135	2025-06-13 00:07:48.913489	28
35	BROSTY ARROZ 	pollosbrostyarrozp@gmail.com	$2b$10$Y8n4S/Epq.AY1k.f2V77..bgtj6lV6hzuEC8p5myAofgzp1IGWOPy	aliado	activo	3151518297	Carrera 4#3-31 centro	2025-06-13 01:02:24.885864	2025-06-13 01:03:00.003838	29
37	Candilejas	berriol1998@gmail.com	$2b$10$IXwFMqrR3drK0k4DjSwt5u19RJEif.rGKzDCmZXzyVYlrMm90sg02	aliado	activo	3132853337	Avenida 3 17 99 sur	2025-06-13 03:36:02.368136	2025-06-13 03:36:43.023303	31
38	Imperio chino 	imperiochino36@gmail.com	$2b$10$y29DLReed83DD36KVspytOTHaqGlYIwBzukn0lZphoTBljwxv2Ub6	aliado	activo	3187736506	Carrera 15 # 9 a 20 cálamo 	2025-06-13 16:14:16.662795	2025-06-13 16:15:07.281735	32
39	Arroz sazón y sabor	arrozencanto25@gmail.com	$2b$10$y/mpBhxxO.IwrnZNIhxoReCFY8JXAiGWheUBaGiKZF.3LUEa8FKhK	aliado	activo	3204088446	Calle 4 b #20-13 diagonal a la estación de servicio 	2025-06-13 17:15:09.150677	2025-06-13 17:17:33.335886	33
40	Chef broaster 	yerlypjg@gmail.com	$2b$10$v7VGesDKn6Ure8qJ9dV/N.e4TrglTvCbf5KHGzqbIRrqikmnMmr62	aliado	activo	3208750826	Calle 3#3-65 centro 	2025-06-13 17:59:49.267599	2025-06-13 18:00:19.346096	34
41	Fogón de oro 	enriqueropar1973@gmail.com	$2b$10$mAXA033H7RfkqX4NcOLNgeDV8i.YI2.EtqzHFYkLDIeyoQv.f8pz.	aliado	activo	3160556483	Carrera 5 # 6-68 centro 	2025-06-13 18:51:02.023521	2025-06-13 18:52:32.927318	35
42	Hotel gran premium 	hotelgrandpremiumplaza@gmail.com	$2b$10$OQF15wGQwlPTB63NLbroEuWXtc61M0Vfbt9puR1lyuh9f90PikPxm	aliado	activo	3115434648	Carr 4 # 4-08 2 piso centro 	2025-06-13 19:30:45.311585	2025-06-13 19:30:58.444833	36
8	Pizza vianda 	alvarezwilber262@gmail.com	$2b$10$7aDqKfE5O.7a9MS.DOC9uuzQme7dtLOX8ew/x24O.2IEhFiqhRQNu	aliado	activo	3124450462	Avenida 3 # 10 sur 27 solarte	2025-06-11 04:38:39.342085	2025-06-14 03:43:56.717105	7
43	El granjero	fabioleon.0603@gmail.com	$2b$10$K7pbT1EFQea.s0o07GhA.OZMcEPbXzyF5r7Xq.2RreEboqTDGeNy6	aliado	activo	3136806563	Carr 4#9-13 centro 	2025-06-13 19:44:47.789923	2025-06-13 19:45:11.713119	37
44	Terra viva	miguelsalasmendez@gmail.com	$2b$10$Ml0Ke3vhKwqtPmDKn8IlqOWNG2Gsydjfz5NTNz47bVIkSPaArme2S	aliado	activo	3205300112	Carrera 4 # 3-76 centro 	2025-06-13 20:07:57.690556	2025-06-13 20:08:14.612832	38
45	Salchip paisa pitalito	salchipaisapitalito@gmail.com	$2b$10$gNXmrlbFlgkn9e.Pe.lKTO5q1aBhLIyCui65rgP3s3BJy7M9OwsUu	aliado	activo	3145896754	Carr 16a # 4-48 San Mateo 	2025-06-13 22:36:48.918174	2025-06-13 22:37:07.452748	39
46	Dulce manía	vidalcf123@gmail.com	$2b$10$hYpYsvYbYKEzwh3v85Le7Oq1SnxS/i8UqdTiQeNQi7QerVxfht94u	aliado	activo	3143253124	Calle 3 sur # 2-79 nogales 	2025-06-13 23:22:04.870789	2025-06-13 23:22:46.642873	40
47	Arepas by	camilamottamv@hotmail.com	$2b$10$J3nKHHXSmIh.cVZkHUTtxOmvQSL/nbMwoDl/SBjonRDWe3Wax4cIy	aliado	activo	3228532363	Calle 4#1b- 62 quinche	2025-06-14 00:09:43.135002	2025-06-14 00:10:04.583207	41
48	Brunchosos 	brunchososcolombia@gmail.com	$2b$10$KVoKR3J66NvEfz4c6LsgXuvaQak45O5JSwIZErCo05v99xmFcCRju	aliado	activo	 318 4951384	Carrera 1a # 3-57 quinche	2025-06-14 01:03:58.775023	2025-06-14 01:24:57.300266	42
49	Italian Pizza 	stevengonzalezalvarez15@gmail.com	$2b$10$L1VB.1HubfwnsCZEfJvsAOBOAgB87YChfh2fBFywElkhVgeYsOlqW	aliado	activo	3124713005	Calle 11a #3-11	2025-06-14 02:31:52.199504	2025-06-14 02:32:17.741303	43
50	Carol	carolchilito55@gmail.com	$2b$10$HRjsO0GJNCGPR5FcPKvwouojj5SiLvTO4Lux4LsMudegBCxXcsSuq	aliado	activo	3229361909	Carr 3 11-14 centro 	2025-06-14 03:03:15.924923	2025-06-14 03:03:34.312771	44
51	Asado huilense 	hermeslo77@gmail.com	$2b$10$nHxMrrov4qvWwBVpiuCLEefTcoFGoFrfmzyTfYHR3.eWFiAIrWW26	aliado	activo	 316 2268416	Carrera 1 b - 11-04 andes 	2025-06-14 18:31:58.66979	2025-06-14 18:33:44.432289	45
52	Fantasías 	yudinata2020@gmail.com	$2b$10$8WgjVyWa4cAcSOYddhqJ7eCMKc3Uc9O3iX4S5uRB6XTsPsASQe8w2	aliado	activo	3118526350	Carrera 1 #11-35 andes 	2025-06-14 19:34:30.315604	2025-06-14 19:37:05.428382	46
53	Fierro 	fierroalfonsoramon@gmail.com	$2b$10$yEvSXIVP7CqvaLsflO9Kpu/wVDFRMZPckXPk5PpQnZ8sBNRBqxN1a	aliado	activo	3208546628	Calle 1 1este 35 lagos	2025-06-14 20:41:25.102677	2025-06-14 20:41:57.052301	47
54	Crocan 	maurotorresvet@gmail.com	$2b$10$HZJeWiF5ISEUAon8bWl9QOCV59gR482pJhzBndqxlyVDLdqA62y.W	aliado	activo	3148726422	Carrera 5 #4-12 centro 	2025-06-16 01:01:51.513658	2025-06-16 01:02:15.573142	48
55	Luchy perfumería 	Wilsonvilla199@gmail.com	$2b$10$UxO8U/8X1.o35TVInGN0kOwnSze.GPYjNTGBupaFHYmf5rDKuIOrK	aliado	activo	3209834111	Carre 4#7-68 centro 	2025-06-16 01:28:57.793228	2025-06-16 01:29:11.388095	49
56	Gran pollo	Gerenciagranpollo@sofalgastronomia.com	$2b$10$fguvKIr7D8g9yi3Sr96IVOUGGWJP8xr6jiWA/sZn.XFP0b.6kv8m.	aliado	activo	3106097040	Carrera 3 # 7-48 centro 	2025-06-16 20:28:09.514324	2025-06-16 20:28:40.472545	50
\.


--
-- Name: categorias_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categorias_id_seq', 340, true);


--
-- Name: clientes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.clientes_id_seq', 3, true);


--
-- Name: comercios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.comercios_id_seq', 50, true);


--
-- Name: imagenes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.imagenes_id_seq', 21, true);


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.migrations_id_seq', 3, true);


--
-- Name: productos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.productos_id_seq', 576, true);


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.roles_id_seq', 2, true);


--
-- Name: servicios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.servicios_id_seq', 9, true);


--
-- Name: usuarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.usuarios_id_seq', 56, true);


--
-- Name: productos PK_04f604609a0949a7f3b43400766; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT "PK_04f604609a0949a7f3b43400766" PRIMARY KEY (id);


--
-- Name: categorias PK_3886a26251605c571c6b4f861fe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT "PK_3886a26251605c571c6b4f861fe" PRIMARY KEY (id);


--
-- Name: imagenes PK_8a74dd76fc7dcbf7c200583474b; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.imagenes
    ADD CONSTRAINT "PK_8a74dd76fc7dcbf7c200583474b" PRIMARY KEY (id);


--
-- Name: migrations PK_8c82d7f526340ab734260ea46be; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);


--
-- Name: roles PK_c1433d71a4838793a49dcad46ab; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY (id);


--
-- Name: usuarios PK_d7281c63c176e152e4c531594a8; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT "PK_d7281c63c176e152e4c531594a8" PRIMARY KEY (id);


--
-- Name: clientes PK_d76bf3571d906e4e86470482c08; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT "PK_d76bf3571d906e4e86470482c08" PRIMARY KEY (id);


--
-- Name: comercios PK_f886203d76afacf779ac3a562c3; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comercios
    ADD CONSTRAINT "PK_f886203d76afacf779ac3a562c3" PRIMARY KEY (id);


--
-- Name: servicios PK_fefcdbfeaf506ca485a6dcfb0d8; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servicios
    ADD CONSTRAINT "PK_fefcdbfeaf506ca485a6dcfb0d8" PRIMARY KEY (id);


--
-- Name: clientes UQ_3cd5652ab34ca1a0a2c7a255313; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT "UQ_3cd5652ab34ca1a0a2c7a255313" UNIQUE (email);


--
-- Name: usuarios UQ_446adfc18b35418aac32ae0b7b5; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT "UQ_446adfc18b35418aac32ae0b7b5" UNIQUE (email);


--
-- Name: comercios FK_1be6ea640f5da67b11fd4798111; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comercios
    ADD CONSTRAINT "FK_1be6ea640f5da67b11fd4798111" FOREIGN KEY (servicio_id) REFERENCES public.servicios(id);


--
-- Name: productos FK_3f08f2bea6e23e149898845341a; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT "FK_3f08f2bea6e23e149898845341a" FOREIGN KEY ("comercioId") REFERENCES public.comercios(id);


--
-- Name: usuarios FK_7b87ece4d89b3f4d79c0fac5e65; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT "FK_7b87ece4d89b3f4d79c0fac5e65" FOREIGN KEY (comercio_id) REFERENCES public.comercios(id);


--
-- Name: clientes FK_a065860eb526aad31fcd8ae54e1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT "FK_a065860eb526aad31fcd8ae54e1" FOREIGN KEY (rol_id) REFERENCES public.roles(id);


--
-- Name: productos FK_aee00189e42dd8880cdfe1bb1e7; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT "FK_aee00189e42dd8880cdfe1bb1e7" FOREIGN KEY ("categoriaId") REFERENCES public.categorias(id);


--
-- Name: categorias FK_f1a00af57c79e47d4d4ead89d66; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT "FK_f1a00af57c79e47d4d4ead89d66" FOREIGN KEY (comercio_id) REFERENCES public.comercios(id);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--

