--
-- PostgreSQL database dump
--

\restrict Uker7W8v1eqxvFFN4JsySjMDr5lt6235zaGdAn9Qyj5Pzd9ZelWoDsId1lMipHh

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

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
-- Name: AbnormalityStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AbnormalityStatus" AS ENUM (
    'OPEN',
    'MONITORING',
    'CLOSED'
);


ALTER TYPE public."AbnormalityStatus" OWNER TO postgres;

--
-- Name: ApprovalStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ApprovalStatus" AS ENUM (
    'WAITING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public."ApprovalStatus" OWNER TO postgres;

--
-- Name: ApprovalType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ApprovalType" AS ENUM (
    'DESIGN_REVISION',
    'INVENTORY_UPDATE'
);


ALTER TYPE public."ApprovalType" OWNER TO postgres;

--
-- Name: DesignType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."DesignType" AS ENUM (
    'JF',
    'EQ'
);


ALTER TYPE public."DesignType" OWNER TO postgres;

--
-- Name: LifecycleStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."LifecycleStatus" AS ENUM (
    'ACTIVE',
    'UNDER_REPAIR',
    'UNDER_IMPROVEMENT',
    'OBSOLETE',
    'SCRAP'
);


ALTER TYPE public."LifecycleStatus" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: abnormality; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.abnormality (
    id text NOT NULL,
    design_id text NOT NULL,
    reported_by_id text NOT NULL,
    type text NOT NULL,
    description text NOT NULL,
    status public."AbnormalityStatus" DEFAULT 'OPEN'::public."AbnormalityStatus" NOT NULL,
    date_found timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    found_by text NOT NULL,
    root_cause text NOT NULL,
    temp_action text NOT NULL,
    corrective_action text NOT NULL,
    action_pic text NOT NULL,
    link_to_revision boolean DEFAULT false NOT NULL,
    link_to_spare boolean DEFAULT false NOT NULL,
    resolved_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.abnormality OWNER TO postgres;

--
-- Name: approval; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.approval (
    id text NOT NULL,
    type public."ApprovalType" NOT NULL,
    status public."ApprovalStatus" DEFAULT 'WAITING'::public."ApprovalStatus" NOT NULL,
    design_id text NOT NULL,
    revision_note text,
    submitted_by_id text NOT NULL,
    submitted_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    section_head_id text,
    section_status public."ApprovalStatus" DEFAULT 'WAITING'::public."ApprovalStatus" NOT NULL,
    section_comment text,
    section_at timestamp(3) without time zone,
    dept_head_id text,
    dept_status public."ApprovalStatus" DEFAULT 'WAITING'::public."ApprovalStatus" NOT NULL,
    dept_comment text,
    dept_at timestamp(3) without time zone,
    final_status public."ApprovalStatus" DEFAULT 'WAITING'::public."ApprovalStatus" NOT NULL,
    final_comment text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.approval OWNER TO postgres;

--
-- Name: design; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.design (
    id text NOT NULL,
    no_reg text NOT NULL,
    type public."DesignType" DEFAULT 'JF'::public."DesignType" NOT NULL,
    no_item text NOT NULL,
    qty text NOT NULL,
    rev_status text,
    line_id text NOT NULL,
    process_id text NOT NULL,
    vendor_id text,
    inventory_status text DEFAULT 'GREEN'::text NOT NULL,
    abnormality_status text DEFAULT 'RESOLVED'::text NOT NULL,
    lifecycle_status public."LifecycleStatus" DEFAULT 'ACTIVE'::public."LifecycleStatus" NOT NULL,
    assy_part_name text NOT NULL,
    minimum_stock integer DEFAULT 0 NOT NULL,
    actual_stock integer DEFAULT 0 NOT NULL,
    design_date_last timestamp(3) without time zone,
    design_date_new timestamp(3) without time zone,
    new_visual_design text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.design OWNER TO postgres;

--
-- Name: document; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document (
    id text NOT NULL,
    design_id text NOT NULL,
    "2d_path" text,
    "2d_loc" text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    approval_status text DEFAULT 'APPROVED'::text NOT NULL
);


ALTER TABLE public.document OWNER TO postgres;

--
-- Name: inventory_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_log (
    id text NOT NULL,
    design_id text NOT NULL,
    changed_by_id text NOT NULL,
    prev_min_stock integer NOT NULL,
    new_min_stock integer NOT NULL,
    prev_act_stock integer NOT NULL,
    new_act_stock integer NOT NULL,
    indicator text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.inventory_log OWNER TO postgres;

--
-- Name: line; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.line (
    id text NOT NULL,
    line_name text NOT NULL,
    line_code text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.line OWNER TO postgres;

--
-- Name: notification; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification (
    id text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    design_id text,
    user_id text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.notification OWNER TO postgres;

--
-- Name: process; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.process (
    id text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.process OWNER TO postgres;

--
-- Name: revision_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.revision_history (
    id text NOT NULL,
    design_id text NOT NULL,
    rev_status text NOT NULL,
    description text NOT NULL,
    changed_by_id text NOT NULL,
    vendor_id text,
    po_number text,
    cost double precision DEFAULT 0,
    lead_time integer,
    approved_by_name text,
    "3d_path" text,
    "3d_loc" text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "2d_loc" text,
    "2d_path" text
);


ALTER TABLE public.revision_history OWNER TO postgres;

--
-- Name: role; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role (
    id text NOT NULL,
    name text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.role OWNER TO postgres;

--
-- Name: user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."user" (
    id text NOT NULL,
    name text NOT NULL,
    npk text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    role_id text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."user" OWNER TO postgres;

--
-- Name: vendor; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendor (
    id text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.vendor OWNER TO postgres;

--
-- Data for Name: abnormality; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.abnormality (id, design_id, reported_by_id, type, description, status, date_found, found_by, root_cause, temp_action, corrective_action, action_pic, link_to_revision, link_to_spare, resolved_at, created_at, updated_at) FROM stdin;
cmsny1gx30000nkryq7j91i1r	cmsmywc410000qgry7n41ea3h	cmsmnx54d0004k4rytkb9u3ju	RUSAK	Mangkrak	MONITORING	2026-08-11 00:00:00	Lae	Adit tidak masuk	follow up	tidak ada		t	f	\N	2026-08-11 00:50:13.095	2026-08-11 00:50:13.095
\.


--
-- Data for Name: approval; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.approval (id, type, status, design_id, revision_note, submitted_by_id, submitted_at, section_head_id, section_status, section_comment, section_at, dept_head_id, dept_status, dept_comment, dept_at, final_status, final_comment, created_at, updated_at) FROM stdin;
cmsmnx5sl005hk4rytge1pc9n	DESIGN_REVISION	WAITING	cmsmnx5ru005bk4rymuf0adp5	Revisi diameter pin locator OP#1 PressFit agar presisi masuk ke bush.	cmsmnx54d0004k4rytkb9u3ju	2026-08-10 03:19:09.717	cmsmnx55w0005k4ryyeh79fx6	WAITING	\N	\N	cmsmnx55z0006k4ryofcou2hl	WAITING	\N	\N	WAITING	\N	2026-08-10 03:19:09.717	2026-08-10 03:19:09.717
cmsmnx5ss005ik4ry27uv1tp4	INVENTORY_UPDATE	WAITING	cmsmnx5lh0031k4ryho8j1nn8	Penyesuaian limit stok minimal karena peningkatan volume produksi line stem.	cmsmnx54d0004k4rytkb9u3ju	2026-08-10 03:19:09.724	cmsmnx55w0005k4ryyeh79fx6	WAITING	\N	\N	cmsmnx55z0006k4ryofcou2hl	WAITING	\N	\N	WAITING	\N	2026-08-10 03:19:09.724	2026-08-10 03:19:09.724
cmsmnx5su005jk4ryffnuyoah	DESIGN_REVISION	WAITING	cmsmnx5n8003rk4ryjjywq50c	Modifikasi clamp bracket assembly untuk mencegah goresan pada part.	cmsmnx54d0004k4rytkb9u3ju	2026-08-10 03:19:09.726	cmsmnx55w0005k4ryyeh79fx6	WAITING	\N	\N	cmsmnx55z0006k4ryofcou2hl	WAITING	\N	\N	WAITING	\N	2026-08-10 03:19:09.726	2026-08-10 03:19:09.726
cmsmnx5sw005kk4ryg67ncnww	INVENTORY_UPDATE	WAITING	cmsmnx5lc002zk4ryx7hhjeb4	Koreksi data aktual stok fisik bulanan.	cmsmnx54d0004k4rytkb9u3ju	2026-08-10 03:19:09.728	cmsmnx55w0005k4ryyeh79fx6	WAITING	\N	\N	cmsmnx55z0006k4ryofcou2hl	WAITING	\N	\N	WAITING	\N	2026-08-10 03:19:09.728	2026-08-10 03:19:09.728
cmsmnx5sy005lk4ry9ft6chf4	DESIGN_REVISION	WAITING	cmsmnx5g40015k4ryut2u2e8k	Perbaikan slider unit OP#4 Bending untuk mempermudah loading part.	cmsmnx54d0004k4rytkb9u3ju	2026-08-10 03:19:09.73	cmsmnx55w0005k4ryyeh79fx6	WAITING	\N	\N	cmsmnx55z0006k4ryofcou2hl	WAITING	\N	\N	WAITING	\N	2026-08-10 03:19:09.73	2026-08-10 03:19:09.73
cmsmny2jn005dx8ryzc1c29cr	DESIGN_REVISION	WAITING	cmsmnx5ru005bk4rymuf0adp5	Revisi diameter pin locator OP#1 PressFit agar presisi masuk ke bush.	cmsmnx54d0004k4rytkb9u3ju	2026-08-10 03:19:52.163	cmsmnx55w0005k4ryyeh79fx6	WAITING	\N	\N	cmsmnx55z0006k4ryofcou2hl	WAITING	\N	\N	WAITING	\N	2026-08-10 03:19:52.163	2026-08-10 03:19:52.163
cmsmny2jq005ex8ryj62wlddy	INVENTORY_UPDATE	WAITING	cmsmnx5lh0031k4ryho8j1nn8	Penyesuaian limit stok minimal karena peningkatan volume produksi line stem.	cmsmnx54d0004k4rytkb9u3ju	2026-08-10 03:19:52.166	cmsmnx55w0005k4ryyeh79fx6	WAITING	\N	\N	cmsmnx55z0006k4ryofcou2hl	WAITING	\N	\N	WAITING	\N	2026-08-10 03:19:52.166	2026-08-10 03:19:52.166
cmsmny2ju005gx8ryfpz9auqm	INVENTORY_UPDATE	WAITING	cmsmnx5lc002zk4ryx7hhjeb4	Koreksi data aktual stok fisik bulanan.	cmsmnx54d0004k4rytkb9u3ju	2026-08-10 03:19:52.17	cmsmnx55w0005k4ryyeh79fx6	WAITING	\N	\N	cmsmnx55z0006k4ryofcou2hl	WAITING	\N	\N	WAITING	\N	2026-08-10 03:19:52.17	2026-08-10 03:19:52.17
cmsmny2jw005hx8ry2zb53m72	DESIGN_REVISION	WAITING	cmsmnx5g40015k4ryut2u2e8k	Perbaikan slider unit OP#4 Bending untuk mempermudah loading part.	cmsmnx54d0004k4rytkb9u3ju	2026-08-10 03:19:52.172	cmsmnx55w0005k4ryyeh79fx6	WAITING	\N	\N	cmsmnx55z0006k4ryofcou2hl	WAITING	\N	\N	WAITING	\N	2026-08-10 03:19:52.172	2026-08-10 03:19:52.172
cmsmvf4z100011kryjw29jgdg	DESIGN_REVISION	APPROVED	cmsmnx5re0057k4rynl41v6ss	Patah	cmsmnx54d0004k4rytkb9u3ju	2026-08-10 06:49:05.773	cmsmnx55w0005k4ryyeh79fx6	APPROVED		2026-08-10 06:49:27.949	cmsmnx55z0006k4ryofcou2hl	APPROVED		2026-08-10 06:49:42.631	APPROVED		2026-08-10 06:49:05.773	2026-08-10 06:49:42.637
cmsmny2js005fx8rypq2u5jpx	DESIGN_REVISION	APPROVED	cmsmnx5n8003rk4ryjjywq50c	Modifikasi clamp bracket assembly untuk mencegah goresan pada part.	cmsmnx54d0004k4rytkb9u3ju	2026-08-10 03:19:52.168	cmsmnx55w0005k4ryyeh79fx6	APPROVED		2026-08-11 04:41:43.472	cmsmnx55z0006k4ryofcou2hl	APPROVED		2026-08-11 04:41:51.309	APPROVED		2026-08-10 03:19:52.168	2026-08-11 04:41:51.314
cmsmw4n1c00061kryp5knm0dd	DESIGN_REVISION	APPROVED	cmsmw3oj800002wrygy85hepm	Busung lapar	cmsmnx54d0004k4rytkb9u3ju	2026-08-10 07:08:55.584	cmsmnx55w0005k4ryyeh79fx6	APPROVED		2026-08-10 07:09:28.044	cmsmnx55z0006k4ryofcou2hl	APPROVED		2026-08-10 07:09:36.802	APPROVED		2026-08-10 07:08:55.584	2026-08-10 07:09:36.804
cmsmw7h3m000b1kryvph7mqgp	DESIGN_REVISION	APPROVED	cmsmw3oj800002wrygy85hepm	Twst	cmsmnx54d0004k4rytkb9u3ju	2026-08-10 07:11:07.858	cmsmnx55w0005k4ryyeh79fx6	APPROVED		2026-08-10 07:11:34.384	cmsmnx55z0006k4ryofcou2hl	APPROVED		2026-08-10 07:11:39.944	APPROVED		2026-08-10 07:11:07.858	2026-08-10 07:11:39.947
cmsmwejgz000g1krydk3q6hbp	DESIGN_REVISION	APPROVED	cmsmw3oj800002wrygy85hepm	Testing PDF upload failure debug	cmsmnx54d0004k4rytkb9u3ju	2026-08-10 07:16:37.523	cmsmnx55w0005k4ryyeh79fx6	APPROVED		2026-08-10 07:23:15.076	cmsmnx55z0006k4ryofcou2hl	APPROVED		2026-08-10 07:23:24.762	APPROVED		2026-08-10 07:16:37.523	2026-08-10 07:23:24.763
cmsmz8k0b0001n4ry64c1tywj	DESIGN_REVISION	APPROVED	cmsmywc410000qgry7n41ea3h	Mangkrak	cmsmnx54d0004k4rytkb9u3ju	2026-08-10 08:35:57.131	cmsmnx55w0005k4ryyeh79fx6	APPROVED		2026-08-11 00:50:32.884	cmsmnx55z0006k4ryofcou2hl	APPROVED		2026-08-11 00:50:41.833	APPROVED		2026-08-10 08:35:57.131	2026-08-11 00:50:41.838
cmso3koze0001zkry3240cj6q	DESIGN_REVISION	APPROVED	cmsmywc410000qgry7n41ea3h	3D	cmsmnx54d0004k4rytkb9u3ju	2026-08-11 03:25:08.09	cmsmnx55w0005k4ryyeh79fx6	APPROVED		2026-08-11 03:25:18.545	cmsmnx55z0006k4ryofcou2hl	APPROVED		2026-08-11 03:25:25.121	APPROVED		2026-08-11 03:25:08.09	2026-08-11 03:25:25.124
\.


--
-- Data for Name: design; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.design (id, no_reg, type, no_item, qty, rev_status, line_id, process_id, vendor_id, inventory_status, abnormality_status, lifecycle_status, assy_part_name, minimum_stock, actual_stock, design_date_last, design_date_new, new_visual_design, created_at, updated_at) FROM stdin;
cmsmnx5ff000xk4ry2171o4z7	TXMACH-ASAU010100	JF	01	1set	1	cmsmny2870004x8rys30tumh4	cmsmny28z000fx8ryw6wwtf9q	default-vendor	GREEN	RESOLVED	ACTIVE	Sub Assy 1 :	2	3	2017-12-07 00:00:00	2025-11-09 00:00:00	http://localhost:3001/images/MASTER_LIST_img1.png	2026-08-10 03:19:09.243	2026-08-10 03:19:51.81
cmsmnx5jf002bk4ry3038xkey	TXMACH-ASAUGR0100	EQ	01	4set	1	cmsmny2870004x8rys30tumh4	cmsmny291000gx8rywz21m3qc	default-vendor	GREEN	RESOLVED	ACTIVE	Sub Assy Gripper	0	0	\N	\N	\N	2026-08-10 03:19:09.387	2026-08-10 03:19:51.934
cmsmnx5fn000zk4ryx5tk8rzm	TXMACH-ASAU010101	JF	1.1	1	1	cmsmny2870004x8rys30tumh4	cmsmny28z000fx8ryw6wwtf9q	default-vendor	GREEN	RESOLVED	ACTIVE	a. Base Plate	2	4	2017-12-07 00:00:00	2025-11-09 00:00:00	http://localhost:3001/images/MASTER_LIST_img2.png	2026-08-10 03:19:09.251	2026-08-10 03:19:51.817
cmsmnx5ft0011k4ryiml40eig	TXMACH-ASAU010102	JF	1.2	1	1	cmsmny2870004x8rys30tumh4	cmsmny28z000fx8ryw6wwtf9q	default-vendor	GREEN	RESOLVED	ACTIVE	b. Datum	2	3	2017-12-07 00:00:00	2025-11-09 00:00:00	http://localhost:3001/images/MASTER_LIST_img3.png	2026-08-10 03:19:09.257	2026-08-10 03:19:51.824
cmsmnx5fy0013k4ryqrw4r73n	TXMACH-ASAU010103	JF	1.3	2	1	cmsmny2870004x8rys30tumh4	cmsmny28z000fx8ryw6wwtf9q	default-vendor	GREEN	RESOLVED	ACTIVE	c. Pin Positioning	2	1	2017-12-07 00:00:00	2025-11-09 00:00:00	http://localhost:3001/images/MASTER_LIST_img4.png	2026-08-10 03:19:09.262	2026-08-10 03:19:51.83
cmsmnx5g40015k4ryut2u2e8k	M12x1.75 X 50	JF	1.4	1	N/A	cmsmny2870004x8rys30tumh4	cmsmny28z000fx8ryw6wwtf9q	default-vendor	GREEN	RESOLVED	ACTIVE	d. Baut Inbus	2	3	2017-12-07 00:00:00	2025-11-09 00:00:00	http://localhost:3001/images/MASTER_LIST_img5.png	2026-08-10 03:19:09.268	2026-08-10 03:19:51.834
cmsmnx5ga0017k4rycowq66f3	M8x1.25 X 20	JF	1.5	2	N/A	cmsmny2870004x8rys30tumh4	cmsmny28z000fx8ryw6wwtf9q	default-vendor	GREEN	RESOLVED	ACTIVE	e. Baut Inbus	2	2	2017-12-07 00:00:00	2025-11-09 00:00:00	http://localhost:3001/images/MASTER_LIST_img6.png	2026-08-10 03:19:09.274	2026-08-10 03:19:51.842
cmsmnx5ge0019k4ryldt8io3w	TXMACH-ASAU012A00	JF	2A	1set	1	cmsmny2870004x8rys30tumh4	cmsmny28z000fx8ryw6wwtf9q	default-vendor	GREEN	RESOLVED	ACTIVE	Sub Assy 2A (K1AL/KZLG) :	2	2	2017-12-07 00:00:00	2025-11-09 00:00:00	http://localhost:3001/images/MASTER_LIST_img7.png	2026-08-10 03:19:09.278	2026-08-10 03:19:51.849
cmsmnx5gj001bk4ry33cu6h3w	TXMACH-ASAU012A01	JF	2.1	1	1	cmsmny2870004x8rys30tumh4	cmsmny28z000fx8ryw6wwtf9q	default-vendor	GREEN	RESOLVED	ACTIVE	a. Cassete K1AL/KZLG	2	3	2017-12-07 00:00:00	2025-11-09 00:00:00	http://localhost:3001/images/MASTER_LIST_img8.png	2026-08-10 03:19:09.283	2026-08-10 03:19:51.854
cmsmnx5gp001dk4ry76qz2pw0	TXMACH-ASAU012A02	JF	2.2	2	1	cmsmny2870004x8rys30tumh4	cmsmny28z000fx8ryw6wwtf9q	default-vendor	GREEN	RESOLVED	ACTIVE	b. Pin K1AL/KZLG	2	2	2017-12-07 00:00:00	2025-11-09 00:00:00	http://localhost:3001/images/MASTER_LIST_img9.png	2026-08-10 03:19:09.289	2026-08-10 03:19:51.859
cmsmnx5i8001xk4ryatfts5bc	TXMACH-ASAU01EQ01	EQ	EQ1	1	0	cmsmny2870004x8rys30tumh4	cmsmny28z000fx8ryw6wwtf9q	default-vendor	GREEN	RESOLVED	ACTIVE	Contact Plate	0	0	\N	2025-10-09 00:00:00	\N	2026-08-10 03:19:09.344	2026-08-10 03:19:51.902
cmsmnx5h7001jk4ryhehisr5a	TXMACH-ASAU012B01	JF	2.1	1	1	cmsmny2870004x8rys30tumh4	cmsmny28z000fx8ryw6wwtf9q	default-vendor	GREEN	RESOLVED	ACTIVE	a. Cassete K1ALSS/K2FA	2	1	2017-12-07 00:00:00	2025-11-09 00:00:00	http://localhost:3001/images/MASTER_LIST_img12.png	2026-08-10 03:19:09.307	2026-08-10 03:19:51.872
cmsmnx5hb001lk4ryj6viyrht	TXMACH-ASAU012B02	JF	2.2	2	1	cmsmny2870004x8rys30tumh4	cmsmny28z000fx8ryw6wwtf9q	default-vendor	GREEN	RESOLVED	ACTIVE	b. Pin K1ALSS/K2FA	2	2	2017-12-07 00:00:00	2025-11-09 00:00:00	http://localhost:3001/images/MASTER_LIST_img13.png	2026-08-10 03:19:09.311	2026-08-10 03:19:51.876
cmsmnx5hf001nk4ryl1wbvaic	M8x1.25 X 35	JF	2.3	2	N/A	cmsmny2870004x8rys30tumh4	cmsmny28z000fx8ryw6wwtf9q	default-vendor	GREEN	RESOLVED	ACTIVE	c. Baut Inbus	2	1	2017-12-07 00:00:00	2025-11-09 00:00:00	http://localhost:3001/images/MASTER_LIST_img14.png	2026-08-10 03:19:09.315	2026-08-10 03:19:51.88
cmsmnx5hl001pk4ryughmivqs	TXMACH-ASAU012C00	JF	2C	1set	1	cmsmny2870004x8rys30tumh4	cmsmny28z000fx8ryw6wwtf9q	default-vendor	GREEN	RESOLVED	ACTIVE	Sub Assy 2C (K2SA) :	2	3	2017-12-07 00:00:00	2025-11-09 00:00:00	http://localhost:3001/images/MASTER_LIST_img15.png	2026-08-10 03:19:09.321	2026-08-10 03:19:51.884
cmsmnx5hp001rk4ry2l34w55b	TXMACH-ASAU012C01	JF	2.1	1	1	cmsmny2870004x8rys30tumh4	cmsmny28z000fx8ryw6wwtf9q	default-vendor	GREEN	RESOLVED	ACTIVE	a. Cassete K2SA	2	3	2017-12-07 00:00:00	2025-11-09 00:00:00	http://localhost:3001/images/MASTER_LIST_img16.png	2026-08-10 03:19:09.325	2026-08-10 03:19:51.889
cmsmnx5ht001tk4rylkj8bgye	TXMACH-ASAU012C02	JF	2.2	2	1	cmsmny2870004x8rys30tumh4	cmsmny28z000fx8ryw6wwtf9q	default-vendor	GREEN	RESOLVED	ACTIVE	b. Pin K2SA	2	1	2017-12-07 00:00:00	2025-11-09 00:00:00	http://localhost:3001/images/MASTER_LIST_img17.png	2026-08-10 03:19:09.329	2026-08-10 03:19:51.893
cmsmnx5gv001fk4rygnekoqjx	M8x1.25 X 50	JF	2.3	2	N/A	cmsmny2870004x8rys30tumh4	cmsmny28z000fx8ryw6wwtf9q	default-vendor	GREEN	RESOLVED	ACTIVE	c. Baut Inbus	2	2	2017-12-07 00:00:00	2025-11-09 00:00:00	http://localhost:3001/images/MASTER_LIST_img18.png	2026-08-10 03:19:09.295	2026-08-10 03:19:51.897
cmsmnx5id001zk4ry3v5on950	TXMACH-ASAU01EQ02	EQ	EQ2	1	0	cmsmny2870004x8rys30tumh4	cmsmny28z000fx8ryw6wwtf9q	default-vendor	GREEN	RESOLVED	ACTIVE	Spring Plate	0	0	\N	2025-10-09 00:00:00	\N	2026-08-10 03:19:09.349	2026-08-10 03:19:51.907
cmsmnx5ii0021k4ryqz6xequm	TXMACH-ASAU01EQ03	EQ	EQ3	1	0	cmsmny2870004x8rys30tumh4	cmsmny28z000fx8ryw6wwtf9q	default-vendor	GREEN	RESOLVED	ACTIVE	Shaft Holder	0	0	\N	2025-10-09 00:00:00	\N	2026-08-10 03:19:09.354	2026-08-10 03:19:51.911
cmsmnx5il0023k4rygh393x08	TXMACH-ASAU01EQ04	EQ	EQ4	1	0	cmsmny2870004x8rys30tumh4	cmsmny28z000fx8ryw6wwtf9q	default-vendor	GREEN	RESOLVED	ACTIVE	Insert Stopper	0	0	\N	2025-10-09 00:00:00	\N	2026-08-10 03:19:09.357	2026-08-10 03:19:51.916
cmsmnx5iv0025k4ry460c028f	TXMACH-ASAUGR0000	EQ	00	N/A	1	cmsmny2870004x8rys30tumh4	cmsmny291000gx8rywz21m3qc	default-vendor	GREEN	RESOLVED	ACTIVE	Full Assy	0	0	\N	\N	\N	2026-08-10 03:19:09.367	2026-08-10 03:19:51.921
cmsmnx5j30027k4ryvn7pjq8s	Ø6X16	EQ	10	2	0	cmsmny2870004x8rys30tumh4	cmsmny294000ix8ryida5pmr8	default-vendor	GREEN	RESOLVED	ACTIVE	Dowel Pin	0	0	\N	\N	\N	2026-08-10 03:19:09.375	2026-08-10 03:19:52.091
cmsmnx5jk002dk4ry4zouhaj2	TXMACH-ASAUGR011A	EQ	1A	1/set	1	cmsmny2870004x8rys30tumh4	cmsmny291000gx8rywz21m3qc	default-vendor	GREEN	RESOLVED	ACTIVE	Base Gripper K1AL/KZLG	0	0	\N	\N	\N	2026-08-10 03:19:09.392	2026-08-10 03:19:51.938
cmsmnx5jp002fk4ry7lvq64vs	TXMACH-ASAUGR011B	EQ	1B	1/set	1	cmsmny2870004x8rys30tumh4	cmsmny291000gx8rywz21m3qc	default-vendor	GREEN	RESOLVED	ACTIVE	Base Gripper K1ALSS/K2FA	0	0	\N	\N	\N	2026-08-10 03:19:09.397	2026-08-10 03:19:51.942
cmsmnx5jv002hk4ryjo0btib7	TXMACH-ASAUGR011C	EQ	1C	1/set	1	cmsmny2870004x8rys30tumh4	cmsmny291000gx8rywz21m3qc	default-vendor	GREEN	RESOLVED	ACTIVE	Base Gripper K2SA	0	0	\N	\N	\N	2026-08-10 03:19:09.403	2026-08-10 03:19:51.946
cmsmnx5k0002jk4ryxmi96y2i	TXMACH-ASAUGR0102	EQ	2	1/set	1	cmsmny2870004x8rys30tumh4	cmsmny291000gx8rywz21m3qc	default-vendor	GREEN	RESOLVED	ACTIVE	HGPT50 Plate	0	0	\N	\N	\N	2026-08-10 03:19:09.408	2026-08-10 03:19:51.95
cmsmnx5k4002lk4ryg9iquz6y	TXMACH-ASAUGR0103	EQ	3	1/set	1	cmsmny2870004x8rys30tumh4	cmsmny291000gx8rywz21m3qc	default-vendor	GREEN	RESOLVED	ACTIVE	Top Finger	0	0	\N	\N	\N	2026-08-10 03:19:09.412	2026-08-10 03:19:51.954
cmsmnx5n8003rk4ryjjywq50c	HOLLOW 20X30X1290	EQ	5	28	1	cmsmny2870004x8rys30tumh4	cmsmny294000ix8ryida5pmr8	default-vendor	GREEN	RESOLVED	ACTIVE	Bottom Frame	0	1	\N	2026-08-11 04:41:51.336	\N	2026-08-10 03:19:09.524	2026-08-11 04:41:51.339
cmsmnx5ls0035k4ry8gf92hhd	M6X50	EQ	8	4	0	cmsmny2870004x8rys30tumh4	cmsmny294000ix8ryida5pmr8	default-vendor	GREEN	RESOLVED	ACTIVE	Hex Socket Head Bolt	0	0	\N	\N	\N	2026-08-10 03:19:09.472	2026-08-10 03:19:52.084
cmsmnx5pg004nk4rywhs58iqx	TXMACH-ASAU040000	JF	0	1	0	cmsmny2870004x8rys30tumh4	cmsmny296000jx8ryowtuwm3c	default-vendor	GREEN	RESOLVED	ACTIVE	Jig Assy Cone Race	2	3	\N	\N	http://localhost:3001/images/MASTER_LIST_img20.png	2026-08-10 03:19:09.604	2026-08-10 03:19:52.096
cmsmnx5lz0039k4rybr8xx8ou	M6X16	EQ	15	2/set	1	cmsmny2870004x8rys30tumh4	cmsmny291000gx8rywz21m3qc	default-vendor	GREEN	RESOLVED	ACTIVE	Hex Socket Head Bolt	0	0	\N	\N	\N	2026-08-10 03:19:09.479	2026-08-10 03:19:52.006
cmsmnx5ka002nk4ryljkpvsad	TXMACH-ASAUGR0104	EQ	4	1/set	1	cmsmny2870004x8rys30tumh4	cmsmny291000gx8rywz21m3qc	default-vendor	GREEN	RESOLVED	ACTIVE	Bottom Finger	0	0	\N	\N	\N	2026-08-10 03:19:09.418	2026-08-10 03:19:51.959
cmsmnx5kh002pk4rym629htu7	TXMACH-ASAUGR0105	EQ	5	1/set	1	cmsmny2870004x8rys30tumh4	cmsmny291000gx8rywz21m3qc	default-vendor	GREEN	RESOLVED	ACTIVE	Top Pad	0	0	\N	\N	\N	2026-08-10 03:19:09.425	2026-08-10 03:19:51.963
cmsmnx5kn002rk4ry4rfrh7or	TXMACH-ASAUGR0106	EQ	6	1/set	1	cmsmny2870004x8rys30tumh4	cmsmny291000gx8rywz21m3qc	default-vendor	GREEN	RESOLVED	ACTIVE	Bottom Pad	0	0	\N	\N	\N	2026-08-10 03:19:09.431	2026-08-10 03:19:51.967
cmsmnx5kt002tk4rys7wv3p1y	TXMACH-ASAUGR0107	EQ	7	2/set	1	cmsmny2870004x8rys30tumh4	cmsmny291000gx8rywz21m3qc	default-vendor	GREEN	RESOLVED	ACTIVE	Guide Support	0	0	\N	\N	\N	2026-08-10 03:19:09.437	2026-08-10 03:19:51.971
cmsmnx5ky002vk4rymkbird2g	TXMACH-ASAUGR0108	EQ	8	2/set	1	cmsmny2870004x8rys30tumh4	cmsmny291000gx8rywz21m3qc	default-vendor	GREEN	RESOLVED	ACTIVE	Guide Shaft	0	0	\N	\N	\N	2026-08-10 03:19:09.442	2026-08-10 03:19:51.976
cmsmnx5l2002xk4rypm41dtqb	WL20-40 (MISUMI)	EQ	9	2/set	1	cmsmny2870004x8rys30tumh4	cmsmny291000gx8rywz21m3qc	default-vendor	GREEN	RESOLVED	ACTIVE	Wire Spring	0	0	\N	\N	\N	2026-08-10 03:19:09.446	2026-08-10 03:19:51.98
cmsmnx5lc002zk4ryx7hhjeb4	LHIFC16 (MISUMI)	EQ	10	2/set	1	cmsmny2870004x8rys30tumh4	cmsmny291000gx8rywz21m3qc	default-vendor	GREEN	RESOLVED	ACTIVE	Flange Linear Ball Bearing	0	0	\N	\N	\N	2026-08-10 03:19:09.456	2026-08-10 03:19:51.983
cmsmnx5ln0033k4ryd0f8a8zl	M8X16	EQ	7	8	0	cmsmny2870004x8rys30tumh4	cmsmny294000ix8ryida5pmr8	default-vendor	GREEN	RESOLVED	ACTIVE	Hex Socket Head Bolt	0	0	\N	\N	\N	2026-08-10 03:19:09.467	2026-08-10 03:19:52.081
cmsmnx5m4003bk4rygt0uyah8	M4X16	EQ	16	8/set	1	cmsmny2870004x8rys30tumh4	cmsmny291000gx8rywz21m3qc	default-vendor	GREEN	RESOLVED	ACTIVE	Hex Socket Head Bolt	0	0	\N	\N	\N	2026-08-10 03:19:09.484	2026-08-10 03:19:52.009
cmsmnx5mc003fk4ryq5jo9fwk	[object Object]	EQ	18	2/set	1	cmsmny2870004x8rys30tumh4	cmsmny291000gx8rywz21m3qc	default-vendor	GREEN	RESOLVED	ACTIVE	Washer Xlarge	0	0	\N	\N	\N	2026-08-10 03:19:09.492	2026-08-10 03:19:52.016
cmsmnx5mo003jk4ry7ymioqbz	TXMACH-ASAUIN0100	EQ	N/A	N/A	0	cmsmny2870004x8rys30tumh4	cmsmny294000ix8ryida5pmr8	default-vendor	GREEN	RESOLVED	ACTIVE	Sub Assy Frame Holder :	0	0	\N	\N	\N	2026-08-10 03:19:09.504	2026-08-10 03:19:52.026
cmsmnx5mu003lk4ryaaid3uh5	TXMACH-ASAUIN0101	EQ	1	1	0	cmsmny2870004x8rys30tumh4	cmsmny294000ix8ryida5pmr8	default-vendor	GREEN	RESOLVED	ACTIVE	V - Block A	0	0	\N	\N	\N	2026-08-10 03:19:09.51	2026-08-10 03:19:52.029
cmsmnx5my003nk4ry0s10uj2s	TXMACH-ASAUIN0102	EQ	2	28	0	cmsmny2870004x8rys30tumh4	cmsmny294000ix8ryida5pmr8	default-vendor	GREEN	RESOLVED	ACTIVE	V - Block B	0	0	\N	\N	\N	2026-08-10 03:19:09.514	2026-08-10 03:19:52.032
cmsmnx5n3003pk4ryd9255qrj	TXMACH-ASAUIN0103	EQ	3	28	0	cmsmny2870004x8rys30tumh4	cmsmny294000ix8ryida5pmr8	default-vendor	GREEN	RESOLVED	ACTIVE	Base V-Block	0	0	\N	\N	\N	2026-08-10 03:19:09.519	2026-08-10 03:19:52.036
cmsmnx5ni003vk4ryj10nfsnq	M6X30	EQ	6	16	0	cmsmny2870004x8rys30tumh4	cmsmny294000ix8ryida5pmr8	default-vendor	GREEN	RESOLVED	ACTIVE	Baut Inbus	0	0	\N	\N	\N	2026-08-10 03:19:09.534	2026-08-10 03:19:52.046
cmsmnx5no003xk4ryed2g07iu	M5X12	EQ	7	56	0	cmsmny2870004x8rys30tumh4	cmsmny294000ix8ryida5pmr8	default-vendor	GREEN	RESOLVED	ACTIVE	Support Holder	0	0	\N	\N	\N	2026-08-10 03:19:09.54	2026-08-10 03:19:52.049
cmsmnx5nt003zk4ryv2z9xd1z	WASHER M6	EQ	8	16	0	cmsmny2870004x8rys30tumh4	cmsmny294000ix8ryida5pmr8	default-vendor	GREEN	RESOLVED	ACTIVE	Washer	0	0	\N	\N	\N	2026-08-10 03:19:09.545	2026-08-10 03:19:52.052
cmsmnx5ny0041k4rypx1n6694	TXMACH-ASAUIN0200	EQ	N/A	N/A	0	cmsmny2870004x8rys30tumh4	cmsmny294000ix8ryida5pmr8	default-vendor	GREEN	RESOLVED	ACTIVE	Sub Assy Gripper Gantry :	0	0	\N	\N	\N	2026-08-10 03:19:09.55	2026-08-10 03:19:52.056
cmsmnx5o30043k4ryxlpypz6z	TXMACH-ASAUIN0201	EQ	1	1	0	cmsmny2870004x8rys30tumh4	cmsmny294000ix8ryida5pmr8	default-vendor	GREEN	RESOLVED	ACTIVE	Base HGPT50	0	0	\N	\N	\N	2026-08-10 03:19:09.555	2026-08-10 03:19:52.059
cmsmnx5o80045k4ryf1jkiqyw	TXMACH-ASAUIN0202	EQ	2	1	0	cmsmny2870004x8rys30tumh4	cmsmny294000ix8ryida5pmr8	default-vendor	GREEN	RESOLVED	ACTIVE	Double Finger	0	0	\N	\N	\N	2026-08-10 03:19:09.56	2026-08-10 03:19:52.063
cmsmnx5oc0047k4ry88psossy	TXMACH-ASAUIN0203	EQ	3	1	0	cmsmny2870004x8rys30tumh4	cmsmny294000ix8ryida5pmr8	default-vendor	GREEN	RESOLVED	ACTIVE	Single Finger	0	0	\N	\N	\N	2026-08-10 03:19:09.564	2026-08-10 03:19:52.066
cmsmnx5oi0049k4rywfkf1hrd	TXMACH-ASAUIN0204	EQ	4	2	0	cmsmny2870004x8rys30tumh4	cmsmny294000ix8ryida5pmr8	default-vendor	GREEN	RESOLVED	ACTIVE	Double Pad	0	0	\N	\N	\N	2026-08-10 03:19:09.57	2026-08-10 03:19:52.071
cmsmnx5om004bk4rymw78ywc9	TXMACH-ASAUIN0205	EQ	5	1	0	cmsmny2870004x8rys30tumh4	cmsmny294000ix8ryida5pmr8	default-vendor	GREEN	RESOLVED	ACTIVE	Single Pad	0	0	\N	\N	\N	2026-08-10 03:19:09.574	2026-08-10 03:19:52.075
cmsmnx5pm004pk4ry4vpxeron	TXMACH-ASMA010000	JF	0	1set	0	cmsmny28b0005x8ryuykmqeln	cmsmny298000kx8ry9h6du1i0	default-vendor	GREEN	RESOLVED	ACTIVE	Jig Assy Pressfit Manual	2	4	\N	2025-09-09 00:00:00	http://localhost:3001/images/MASTER_LIST_img21.png	2026-08-10 03:19:09.61	2026-08-10 03:19:52.1
cmsmnx5pt004rk4ry84lrfqt2	TXMACHASMA040000	JF	0	1set	0	cmsmny28b0005x8ryuykmqeln	cmsmny296000jx8ryowtuwm3c	default-vendor	GREEN	RESOLVED	ACTIVE	Jig Assy Cone Race	2	2	\N	\N	http://localhost:3001/images/MASTER_LIST_img22.png	2026-08-10 03:19:09.617	2026-08-10 03:19:52.105
cmsmnx5pz004tk4ry2tmdetc5	TXMACH-HFHPMCEK01	JF	N/A	1	0	cmsmny28h0006x8rycgkw1mlb	cmsmny299000lx8ryu2herddt	default-vendor	GREEN	RESOLVED	ACTIVE	Jig Positioning	2	2	\N	\N	http://localhost:3001/images/MASTER_LIST_img23.png	2026-08-10 03:19:09.623	2026-08-10 03:19:52.109
cmsmnx5q4004vk4rysernzd9t	TXMACH-HFDAICEK01	JF	N/A	1	0	cmsmny28k0007x8rymq3m9dfy	cmsmny299000lx8ryu2herddt	default-vendor	GREEN	RESOLVED	ACTIVE	Jig Positioning	2	2	\N	\N	http://localhost:3001/images/MASTER_LIST_img24.png	2026-08-10 03:19:09.629	2026-08-10 03:19:52.113
cmsmnx5qa004xk4ryysruwpxq	TXMACH-HFDAICEK02	JF	N/A	1	0	cmsmny28n0008x8ryh6wlcyn3	cmsmny299000lx8ryu2herddt	default-vendor	GREEN	RESOLVED	ACTIVE	Jig Positioning	2	4	\N	\N	http://localhost:3001/images/MASTER_LIST_img25.png	2026-08-10 03:19:09.634	2026-08-10 03:19:52.116
cmsmnx5lh0031k4ryho8j1nn8	HGPT50 (FESTO)	EQ	6	1	0	cmsmny2870004x8rys30tumh4	cmsmny294000ix8ryida5pmr8	default-vendor	GREEN	RESOLVED	ACTIVE	Parallel Cylinder Gripper	0	1	\N	\N	\N	2026-08-10 03:19:09.461	2026-08-11 01:04:07.019
cmsmywc410000qgry7n41ea3h	xx	JF	ADIT-0135	4	4	cmsmnx5dk000ck4ryu4zqqlb3	cmsmnx5ek000qk4ryinq2mp7a	default-vendor	GREEN	IN_PROGRESS	UNDER_REPAIR	DIES ADIT	4	10	\N	2026-08-11 03:25:25.145	\N	2026-08-10 08:26:27.026	2026-08-11 03:25:25.146
cmsmnx5ru005bk4rymuf0adp5	Belum ada No. Reg	JF	N/A	2	1	cmsmny28x000ex8ry29mkophl	cmsmny29g000qx8ry6pwn0keb	default-vendor	GREEN	RESOLVED	ACTIVE	Spacer Side Cylunder	2	4	\N	\N	http://localhost:3001/images/MASTER_LIST_img33.png	2026-08-10 03:19:09.69	2026-08-10 03:19:52.155
cmsmnx5ey000vk4ryqlaexu82	TXMACH-ASAU010000	JF	00	N/A	1	cmsmny2870004x8rys30tumh4	cmsmny28z000fx8ryw6wwtf9q	default-vendor	GREEN	RESOLVED	ACTIVE	Full Assy	2	1	2017-12-07 00:00:00	2025-11-09 00:00:00	http://localhost:3001/images/MASTER_LIST_img0.png	2026-08-10 03:19:09.226	2026-08-10 03:19:51.801
cmsmnx5re0057k4rynl41v6ss	N/A	EQ	N/A	N/A	2	cmsmny28w000dx8ryvd87xp4m	cmsmny29f000px8ryfc4us76u	default-vendor	GREEN	RESOLVED	ACTIVE	Spacer Cutter Slitting:	0	0	\N	2026-08-10 06:49:42.662	\N	2026-08-10 03:19:09.674	2026-08-10 06:49:42.663
cmsmnx5mg003hk4ryrd46966a	TXMACH-ASAU020000	JF	0	9/set	1	cmsmny2870004x8rys30tumh4	cmsmny293000hx8rythnoikpe	default-vendor	GREEN	RESOLVED	ACTIVE	Datum Jig Welding	2	1	\N	\N	http://localhost:3001/images/MASTER_LIST_img19.png	2026-08-10 03:19:09.496	2026-08-10 03:19:52.021
cmsmnx5j90029k4rytjx553xj	M6X20	EQ	9	4	0	cmsmny2870004x8rys30tumh4	cmsmny294000ix8ryida5pmr8	default-vendor	GREEN	RESOLVED	ACTIVE	Hex Socket Head Bolt	0	0	\N	\N	\N	2026-08-10 03:19:09.381	2026-08-10 03:19:52.087
cmsmnx5qg004zk4ry5uk934wx	TXMACH-HFHPMCEK02	JF	N/A	1	0	cmsmny28p0009x8ryubn868qo	cmsmny299000lx8ryu2herddt	default-vendor	GREEN	RESOLVED	ACTIVE	Jig Positioning	2	2	\N	\N	http://localhost:3001/images/MASTER_LIST_img26.png	2026-08-10 03:19:09.64	2026-08-10 03:19:52.12
cmsmnx5qm0051k4rymkf2ixjo	TXMACH-HC38030000	JF	N/A	1	0	cmsmny28q000ax8ry4jnzny24	cmsmny29b000mx8ryc7w08kpg	default-vendor	GREEN	RESOLVED	ACTIVE	Base Datum	2	3	\N	\N	http://localhost:3001/images/MASTER_LIST_img27.png	2026-08-10 03:19:09.646	2026-08-10 03:19:52.123
cmsmnx5qv0053k4rypc5ypm6g	TXMACH-HF8002EQ01	EQ	N/A	1	0	cmsmny28s000bx8ryjmta1qhi	cmsmny29c000nx8rye0mxefty	default-vendor	GREEN	RESOLVED	ACTIVE	Draw Bar	0	0	\N	\N	\N	2026-08-10 03:19:09.655	2026-08-10 03:19:52.126
cmsmnx5r10055k4ryj92scd1a	TXMACH-HF8002EQ02	EQ	N/A	1	0	cmsmny28s000bx8ryjmta1qhi	cmsmny29c000nx8rye0mxefty	default-vendor	GREEN	RESOLVED	ACTIVE	Ring Draw Bar	0	0	\N	\N	\N	2026-08-10 03:19:09.661	2026-08-10 03:19:52.13
cmsmnx5r80056k4ryh0cwgo5i	TXMACH-UBR523E100	EQ	N/A	8	0	cmsmny28u000cx8ry9qta3wn5	cmsmny29e000ox8ry72b1ek1x	default-vendor	GREEN	RESOLVED	ACTIVE	Spacer Internal Clamp	0	0	\N	\N	\N	2026-08-10 03:19:09.668	2026-08-10 03:19:52.132
cmsmnx5rl0058k4ry4knt4ckk	TXMACH-UB6704E101	EQ	1	1	0	cmsmny28w000dx8ryvd87xp4m	cmsmny29f000px8ryfc4us76u	default-vendor	GREEN	RESOLVED	ACTIVE	Spacer A	0	0	\N	2025-01-10 00:00:00	\N	2026-08-10 03:19:09.682	2026-08-10 03:19:52.138
cmsmnx5rq0059k4ryksj527a7	TXMACH-UB6704E102	EQ	2	1	0	cmsmny28w000dx8ryvd87xp4m	cmsmny29f000px8ryfc4us76u	default-vendor	GREEN	RESOLVED	ACTIVE	Spacer B	0	0	\N	2025-01-10 00:00:00	\N	2026-08-10 03:19:09.686	2026-08-10 03:19:52.14
cmsmnx5rs005ak4ryd0oxeuyi	TXMACH-UB6704E103	EQ	3	2	0	cmsmny28w000dx8ryvd87xp4m	cmsmny29f000px8ryfc4us76u	default-vendor	GREEN	RESOLVED	ACTIVE	Spacer C	0	0	\N	2025-01-10 00:00:00	\N	2026-08-10 03:19:09.688	2026-08-10 03:19:52.142
cmsofacu60000xcryggbxo206	JF-2026-0001	JF	TEST-002	3	0	cmso9xzqf000bc0ry0d2wkxod	cmso9xzqk000cc0ryn8marvyw	default-vendor	GREEN	RESOLVED	ACTIVE	TEST	3	5	\N	2026-08-11 00:00:00	\N	2026-08-11 08:53:01.182	2026-08-11 08:53:01.182
cmsmw3oj800002wrygy85hepm	REG-TEST-999	JF	ITEM-TEST-999	1	6	cmsmnx5d10008k4ry0qyh39aq	cmsmnx5e5000jk4ryvws40kig	default-vendor	GREEN	RESOLVED	ACTIVE	TEST DESIGN	2	0	\N	2026-08-10 07:23:24.789	\N	2026-08-10 07:08:10.868	2026-08-10 07:23:24.79
\.


--
-- Data for Name: document; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.document (id, design_id, "2d_path", "2d_loc", created_at, updated_at, approval_status) FROM stdin;
cmsmnx5f8000wk4ryaf5jfwip	cmsmnx5ey000vk4ryqlaexu82	[object Object]	[object Object]	2026-08-10 03:19:09.236	2026-08-10 03:19:09.236	APPROVED
cmsmnx5fi000yk4ry8k5qvwoz	cmsmnx5ff000xk4ry2171o4z7	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	2026-08-10 03:19:09.246	2026-08-10 03:19:09.246	APPROVED
cmsmnx5fq0010k4ryp2g4xw7j	cmsmnx5fn000zk4ryx5tk8rzm	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	2026-08-10 03:19:09.254	2026-08-10 03:19:09.254	APPROVED
cmsmnx5fw0012k4rystznl5d4	cmsmnx5ft0011k4ryiml40eig	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	2026-08-10 03:19:09.26	2026-08-10 03:19:09.26	APPROVED
cmsmnx5g10014k4ry2fqh2z25	cmsmnx5fy0013k4ryqrw4r73n	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	2026-08-10 03:19:09.266	2026-08-10 03:19:09.266	APPROVED
cmsmnx5g80016k4ryb2pcp4b2	cmsmnx5g40015k4ryut2u2e8k	N/A	N/A	2026-08-10 03:19:09.272	2026-08-10 03:19:09.272	APPROVED
cmsmnx5gc0018k4ryy8r45hid	cmsmnx5ga0017k4rycowq66f3	N/A	N/A	2026-08-10 03:19:09.276	2026-08-10 03:19:09.276	APPROVED
cmsmnx5gg001ak4rykdnobncg	cmsmnx5ge0019k4ryldt8io3w	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	2026-08-10 03:19:09.28	2026-08-10 03:19:09.28	APPROVED
cmsmnx5gn001ck4ryt8j6cqa5	cmsmnx5gj001bk4ry33cu6h3w	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	2026-08-10 03:19:09.287	2026-08-10 03:19:09.287	APPROVED
cmsmnx5gs001ek4ryp9qj3nod	cmsmnx5gp001dk4ry76qz2pw0	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	2026-08-10 03:19:09.292	2026-08-10 03:19:09.292	APPROVED
cmsmnx5gy001gk4ry1whr2xpz	cmsmnx5gv001fk4rygnekoqjx	N/A	N/A	2026-08-10 03:19:09.298	2026-08-10 03:19:09.298	APPROVED
cmsmnx5h9001kk4ry27riiyeg	cmsmnx5h7001jk4ryhehisr5a	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	2026-08-10 03:19:09.309	2026-08-10 03:19:09.309	APPROVED
cmsmnx5hd001mk4ry43npj9vw	cmsmnx5hb001lk4ryj6viyrht	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	2026-08-10 03:19:09.313	2026-08-10 03:19:09.313	APPROVED
cmsmnx5hi001ok4ryzqjsd8bt	cmsmnx5hf001nk4ryl1wbvaic	N/A	N/A	2026-08-10 03:19:09.318	2026-08-10 03:19:09.318	APPROVED
cmsmnx5hn001qk4ry8p7eqwv5	cmsmnx5hl001pk4ryughmivqs	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	2026-08-10 03:19:09.323	2026-08-10 03:19:09.323	APPROVED
cmsmnx5hr001sk4ry951qfhyw	cmsmnx5hp001rk4ry2l34w55b	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	2026-08-10 03:19:09.327	2026-08-10 03:19:09.327	APPROVED
cmsmnx5hv001uk4ryilyja5ux	cmsmnx5ht001tk4rylkj8bgye	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	2026-08-10 03:19:09.331	2026-08-10 03:19:09.331	APPROVED
cmsmnx5i4001wk4ry397je4vy	cmsmnx5gv001fk4rygnekoqjx	N/A	N/A	2026-08-10 03:19:09.34	2026-08-10 03:19:09.34	APPROVED
cmsmnx5ib001yk4rypz5eumzm	cmsmnx5i8001xk4ryatfts5bc	[object Object]	[object Object]	2026-08-10 03:19:09.347	2026-08-10 03:19:09.347	APPROVED
cmsmnx5ig0020k4ryzy65h761	cmsmnx5id001zk4ry3v5on950	[object Object]	[object Object]	2026-08-10 03:19:09.352	2026-08-10 03:19:09.352	APPROVED
cmsmnx5ik0022k4ryr8rfrf7m	cmsmnx5ii0021k4ryqz6xequm	[object Object]	[object Object]	2026-08-10 03:19:09.356	2026-08-10 03:19:09.356	APPROVED
cmsmnx5io0024k4ryi6fqstvw	cmsmnx5il0023k4rygh393x08	[object Object]	[object Object]	2026-08-10 03:19:09.36	2026-08-10 03:19:09.36	APPROVED
cmsmnx5j10026k4ryyhzmd2t8	cmsmnx5iv0025k4ry460c028f	[object Object]	[object Object]	2026-08-10 03:19:09.373	2026-08-10 03:19:09.373	APPROVED
cmsmnx5j60028k4ryszwh6hlv	cmsmnx5j30027k4ryvn7pjq8s	N/A	N/A	2026-08-10 03:19:09.378	2026-08-10 03:19:09.378	APPROVED
cmsmnx5jc002ak4rybesbbf7p	cmsmnx5j90029k4rytjx553xj	N/A	N/A	2026-08-10 03:19:09.384	2026-08-10 03:19:09.384	APPROVED
cmsmnx5ji002ck4ryu4hobc8i	cmsmnx5jf002bk4ry3038xkey	[object Object]	[object Object]	2026-08-10 03:19:09.39	2026-08-10 03:19:09.39	APPROVED
cmsmnx5jn002ek4ry6ga6hd3z	cmsmnx5jk002dk4ry4zouhaj2	[object Object]	[object Object]	2026-08-10 03:19:09.395	2026-08-10 03:19:09.395	APPROVED
cmsmnx5jt002gk4rypbv4q263	cmsmnx5jp002fk4ry7lvq64vs	[object Object]	[object Object]	2026-08-10 03:19:09.401	2026-08-10 03:19:09.401	APPROVED
cmsmnx5jy002ik4ryqiv4zadk	cmsmnx5jv002hk4ryjo0btib7	[object Object]	[object Object]	2026-08-10 03:19:09.406	2026-08-10 03:19:09.406	APPROVED
cmsmnx5k2002kk4ryeixmxuyx	cmsmnx5k0002jk4ryxmi96y2i	[object Object]	[object Object]	2026-08-10 03:19:09.41	2026-08-10 03:19:09.41	APPROVED
cmsmnx5k6002mk4ry1wn1qn4g	cmsmnx5k4002lk4ryg9iquz6y	[object Object]	[object Object]	2026-08-10 03:19:09.414	2026-08-10 03:19:09.414	APPROVED
cmsmnx5kf002ok4ry2tq1mapb	cmsmnx5ka002nk4ryljkpvsad	[object Object]	[object Object]	2026-08-10 03:19:09.423	2026-08-10 03:19:09.423	APPROVED
cmsmnx5kk002qk4ryxcit4tj0	cmsmnx5kh002pk4rym629htu7	[object Object]	[object Object]	2026-08-10 03:19:09.428	2026-08-10 03:19:09.428	APPROVED
cmsmnx5kr002sk4ryhdc0sy3a	cmsmnx5kn002rk4ry4rfrh7or	[object Object]	[object Object]	2026-08-10 03:19:09.435	2026-08-10 03:19:09.435	APPROVED
cmsmnx5kw002uk4rybyfl79sc	cmsmnx5kt002tk4rys7wv3p1y	[object Object]	[object Object]	2026-08-10 03:19:09.44	2026-08-10 03:19:09.44	APPROVED
cmsmnx5l0002wk4ryaoybfhoc	cmsmnx5ky002vk4rymkbird2g	[object Object]	[object Object]	2026-08-10 03:19:09.444	2026-08-10 03:19:09.444	APPROVED
cmsmnx5l9002yk4ryd686k9w4	cmsmnx5l2002xk4rypm41dtqb	N/A	N/A	2026-08-10 03:19:09.453	2026-08-10 03:19:09.453	APPROVED
cmsmnx5le0030k4rykks91vvj	cmsmnx5lc002zk4ryx7hhjeb4	N/A	N/A	2026-08-10 03:19:09.458	2026-08-10 03:19:09.458	APPROVED
cmsmnx5lj0032k4ryb6zz7vjc	cmsmnx5lh0031k4ryho8j1nn8	N/A	N/A	2026-08-10 03:19:09.463	2026-08-10 03:19:09.463	APPROVED
cmsmnx5lq0034k4ryqgqcyuxi	cmsmnx5ln0033k4ryd0f8a8zl	N/A	N/A	2026-08-10 03:19:09.47	2026-08-10 03:19:09.47	APPROVED
cmsmnx5lu0036k4rytb8v62wd	cmsmnx5ls0035k4ry8gf92hhd	N/A	N/A	2026-08-10 03:19:09.474	2026-08-10 03:19:09.474	APPROVED
cmsmnx5ly0038k4rytj3g9qwy	cmsmnx5j90029k4rytjx553xj	N/A	N/A	2026-08-10 03:19:09.478	2026-08-10 03:19:09.478	APPROVED
cmsmnx5m2003ak4ryd26uk30q	cmsmnx5lz0039k4rybr8xx8ou	N/A	N/A	2026-08-10 03:19:09.482	2026-08-10 03:19:09.482	APPROVED
cmsmnx5m6003ck4ry8dkr14tc	cmsmnx5m4003bk4rygt0uyah8	N/A	N/A	2026-08-10 03:19:09.486	2026-08-10 03:19:09.486	APPROVED
cmsmnx5ma003ek4ry47bb1l3f	cmsmnx5j30027k4ryvn7pjq8s	N/A	N/A	2026-08-10 03:19:09.49	2026-08-10 03:19:09.49	APPROVED
cmsmnx5md003gk4ryl7x1oqv4	cmsmnx5mc003fk4ryq5jo9fwk	N/A	N/A	2026-08-10 03:19:09.493	2026-08-10 03:19:09.493	APPROVED
cmsmnx5mj003ik4ryip3hx4j6	cmsmnx5mg003hk4ryrd46966a	[object Object]	[object Object]	2026-08-10 03:19:09.499	2026-08-10 03:19:09.499	APPROVED
cmsmnx5mr003kk4rymcjqhpc2	cmsmnx5mo003jk4ry7ymioqbz	[object Object]	[object Object]	2026-08-10 03:19:09.507	2026-08-10 03:19:09.507	APPROVED
cmsmnx5mw003mk4ry47n18oqs	cmsmnx5mu003lk4ryaaid3uh5	[object Object]	[object Object]	2026-08-10 03:19:09.512	2026-08-10 03:19:09.512	APPROVED
cmsmnx5n1003ok4ryxced43mc	cmsmnx5my003nk4ry0s10uj2s	[object Object]	[object Object]	2026-08-10 03:19:09.517	2026-08-10 03:19:09.517	APPROVED
cmsmnx5n5003qk4ryervq6u91	cmsmnx5n3003pk4ryd9255qrj	[object Object]	[object Object]	2026-08-10 03:19:09.521	2026-08-10 03:19:09.521	APPROVED
cmsmnx5na003sk4ryv1o0uz3i	cmsmnx5n8003rk4ryjjywq50c	[object Object]	[object Object]	2026-08-10 03:19:09.526	2026-08-10 03:19:09.526	APPROVED
cmsmnx5nf003uk4ryvp3as8ld	cmsmnx5n8003rk4ryjjywq50c	[object Object]	[object Object]	2026-08-10 03:19:09.531	2026-08-10 03:19:09.531	APPROVED
cmsmnx5nl003wk4ry2ddhxn2y	cmsmnx5ni003vk4ryj10nfsnq	N/A	N/A	2026-08-10 03:19:09.537	2026-08-10 03:19:09.537	APPROVED
cmsmnx5nr003yk4ryivx4b9f5	cmsmnx5no003xk4ryed2g07iu	N/A	N/A	2026-08-10 03:19:09.543	2026-08-10 03:19:09.543	APPROVED
cmsmnx5nv0040k4ryywcyujmx	cmsmnx5nt003zk4ryv2z9xd1z	N/A	N/A	2026-08-10 03:19:09.547	2026-08-10 03:19:09.547	APPROVED
cmsmnx5o10042k4rygixrp95u	cmsmnx5ny0041k4rypx1n6694	[object Object]	[object Object]	2026-08-10 03:19:09.553	2026-08-10 03:19:09.553	APPROVED
cmsmnx5o60044k4ry4udmgnvq	cmsmnx5o30043k4ryxlpypz6z	..\\01. Design\\001. Auto Assy Steering Stem\\F - Instocker - Outstocker - Gantry\\3. PDF\\TXMACH-ASAUIN0200 GRIPPER GANTRY HGPT50.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\F - Instocker - Outstocker - Gantry\\3. PDF\\TXMACH-ASAUIN0200 GRIPPER GANTRY HGPT50.PDF	2026-08-10 03:19:09.558	2026-08-10 03:19:09.558	APPROVED
cmsmnx5oa0046k4rymfodni82	cmsmnx5o80045k4ryf1jkiqyw	..\\01. Design\\001. Auto Assy Steering Stem\\F - Instocker - Outstocker - Gantry\\3. PDF\\TXMACH-ASAUIN0200 GRIPPER GANTRY HGPT50.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\F - Instocker - Outstocker - Gantry\\3. PDF\\TXMACH-ASAUIN0200 GRIPPER GANTRY HGPT50.PDF	2026-08-10 03:19:09.562	2026-08-10 03:19:09.562	APPROVED
cmsmnx5og0048k4rywqkrd4pj	cmsmnx5oc0047k4ry88psossy	..\\01. Design\\001. Auto Assy Steering Stem\\F - Instocker - Outstocker - Gantry\\3. PDF\\TXMACH-ASAUIN0200 GRIPPER GANTRY HGPT50.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\F - Instocker - Outstocker - Gantry\\3. PDF\\TXMACH-ASAUIN0200 GRIPPER GANTRY HGPT50.PDF	2026-08-10 03:19:09.568	2026-08-10 03:19:09.568	APPROVED
cmsmnx5ok004ak4ryowf3wwo6	cmsmnx5oi0049k4rywfkf1hrd	..\\01. Design\\001. Auto Assy Steering Stem\\F - Instocker - Outstocker - Gantry\\3. PDF\\TXMACH-ASAUIN0200 GRIPPER GANTRY HGPT50.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\F - Instocker - Outstocker - Gantry\\3. PDF\\TXMACH-ASAUIN0200 GRIPPER GANTRY HGPT50.PDF	2026-08-10 03:19:09.572	2026-08-10 03:19:09.572	APPROVED
cmsmnx5op004ck4ry2vkvd0s1	cmsmnx5om004bk4rymw78ywc9	..\\01. Design\\001. Auto Assy Steering Stem\\F - Instocker - Outstocker - Gantry\\3. PDF\\TXMACH-ASAUIN0200 GRIPPER GANTRY HGPT50.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\F - Instocker - Outstocker - Gantry\\3. PDF\\TXMACH-ASAUIN0200 GRIPPER GANTRY HGPT50.PDF	2026-08-10 03:19:09.577	2026-08-10 03:19:09.577	APPROVED
cmsmnx5os004ek4ryiipnhq90	cmsmnx5lh0031k4ryho8j1nn8	N/A	N/A	2026-08-10 03:19:09.58	2026-08-10 03:19:09.58	APPROVED
cmsmnx5oz004gk4rybh4h8svx	cmsmnx5ln0033k4ryd0f8a8zl	N/A	N/A	2026-08-10 03:19:09.587	2026-08-10 03:19:09.587	APPROVED
cmsmnx5p4004ik4ry0icdxx3o	cmsmnx5ls0035k4ry8gf92hhd	N/A	N/A	2026-08-10 03:19:09.592	2026-08-10 03:19:09.592	APPROVED
cmsmnx5p8004kk4ry4u2ed08b	cmsmnx5j90029k4rytjx553xj	N/A	N/A	2026-08-10 03:19:09.596	2026-08-10 03:19:09.596	APPROVED
cmsmnx5pc004mk4ryan63xypj	cmsmnx5j30027k4ryvn7pjq8s	N/A	N/A	2026-08-10 03:19:09.6	2026-08-10 03:19:09.6	APPROVED
cmsmnx5pj004ok4ry0gppo9x3	cmsmnx5pg004nk4rywhs58iqx	[object Object]	[object Object]	2026-08-10 03:19:09.607	2026-08-10 03:19:09.607	APPROVED
cmsmnx5po004qk4ryqr09tzdi	cmsmnx5pm004pk4ry4vpxeron	[object Object]	[object Object]	2026-08-10 03:19:09.612	2026-08-10 03:19:09.612	APPROVED
cmsmnx5px004sk4ry22ke549i	cmsmnx5pt004rk4ry84lrfqt2	[object Object]	[object Object]	2026-08-10 03:19:09.621	2026-08-10 03:19:09.621	APPROVED
cmsmnx5q2004uk4ry78520l87	cmsmnx5pz004tk4ry2tmdetc5	[object Object]	[object Object]	2026-08-10 03:19:09.626	2026-08-10 03:19:09.626	APPROVED
cmsmnx5q7004wk4ryycyvk2p4	cmsmnx5q4004vk4rysernzd9t	[object Object]	[object Object]	2026-08-10 03:19:09.631	2026-08-10 03:19:09.631	APPROVED
cmsmnx5qd004yk4ry77ghd53d	cmsmnx5qa004xk4ryysruwpxq	[object Object]	[object Object]	2026-08-10 03:19:09.637	2026-08-10 03:19:09.637	APPROVED
cmsmnx5qk0050k4rykmq6uv0r	cmsmnx5qg004zk4ry5uk934wx	[object Object]	[object Object]	2026-08-10 03:19:09.644	2026-08-10 03:19:09.644	APPROVED
cmsmnx5qs0052k4ryx6jb1oql	cmsmnx5qm0051k4rymkf2ixjo	[object Object]	[object Object]	2026-08-10 03:19:09.652	2026-08-10 03:19:09.652	APPROVED
cmsmnx5qy0054k4ryn3vasnjv	cmsmnx5qv0053k4rypc5ypm6g	[object Object]	[object Object]	2026-08-10 03:19:09.658	2026-08-10 03:19:09.658	APPROVED
cmsmny29r000sx8rydh2moo1z	cmsmnx5ey000vk4ryqlaexu82	[object Object]	[object Object]	2026-08-10 03:19:51.807	2026-08-10 03:19:51.807	APPROVED
cmsmny29x000ux8ryuyixr91z	cmsmnx5ff000xk4ry2171o4z7	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	2026-08-10 03:19:51.813	2026-08-10 03:19:51.813	APPROVED
cmsmny2em002ux8ry4jfi149r	cmsmnx5l2002xk4rypm41dtqb	N/A	N/A	2026-08-10 03:19:51.982	2026-08-10 03:19:51.982	APPROVED
cmsmny2ep002wx8rypt3it2ox	cmsmnx5lc002zk4ryx7hhjeb4	N/A	N/A	2026-08-10 03:19:51.985	2026-08-10 03:19:51.985	APPROVED
cmsmny2a6000wx8ry4y201frj	cmsmnx5fn000zk4ryx5tk8rzm	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	2026-08-10 03:19:51.822	2026-08-10 03:19:51.822	APPROVED
cmsmny2ac000yx8ry46tlteem	cmsmnx5ft0011k4ryiml40eig	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	2026-08-10 03:19:51.828	2026-08-10 03:19:51.828	APPROVED
cmsmny2ag0010x8ryxpyvijia	cmsmnx5fy0013k4ryqrw4r73n	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	2026-08-10 03:19:51.832	2026-08-10 03:19:51.832	APPROVED
cmsmny2am0012x8ryw06luxg8	cmsmnx5g40015k4ryut2u2e8k	N/A	N/A	2026-08-10 03:19:51.838	2026-08-10 03:19:51.838	APPROVED
cmsmny2au0014x8ry271pfyb2	cmsmnx5ga0017k4rycowq66f3	N/A	N/A	2026-08-10 03:19:51.846	2026-08-10 03:19:51.846	APPROVED
cmsmny2b00016x8ryinh8i6ep	cmsmnx5ge0019k4ryldt8io3w	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	2026-08-10 03:19:51.852	2026-08-10 03:19:51.852	APPROVED
cmsmny2b50018x8ry1yudak90	cmsmnx5gj001bk4ry33cu6h3w	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	2026-08-10 03:19:51.857	2026-08-10 03:19:51.857	APPROVED
cmsmny2b9001ax8ry9pjofm5x	cmsmnx5gp001dk4ry76qz2pw0	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	2026-08-10 03:19:51.862	2026-08-10 03:19:51.862	APPROVED
cmsmny2be001cx8ryzfciqe79	cmsmnx5gv001fk4rygnekoqjx	N/A	N/A	2026-08-10 03:19:51.866	2026-08-10 03:19:51.866	APPROVED
cmsmny2bm001gx8ry6klg818k	cmsmnx5h7001jk4ryhehisr5a	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	2026-08-10 03:19:51.874	2026-08-10 03:19:51.874	APPROVED
cmsmny2bq001ix8rymixfzcmp	cmsmnx5hb001lk4ryj6viyrht	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	2026-08-10 03:19:51.878	2026-08-10 03:19:51.878	APPROVED
cmsmny2bu001kx8ry5d8yqvb1	cmsmnx5hf001nk4ryl1wbvaic	N/A	N/A	2026-08-10 03:19:51.882	2026-08-10 03:19:51.882	APPROVED
cmsmny2bz001mx8ryjvdyycrn	cmsmnx5hl001pk4ryughmivqs	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	2026-08-10 03:19:51.887	2026-08-10 03:19:51.887	APPROVED
cmsmny2c3001ox8rydhwfbten	cmsmnx5hp001rk4ry2l34w55b	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	2026-08-10 03:19:51.891	2026-08-10 03:19:51.891	APPROVED
cmsmny2c7001qx8ryf98f4nwl	cmsmnx5ht001tk4rylkj8bgye	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\A - OP 1 ( Press Fit )\\3. PDF\\REV-TXMACH-ASAU010000 JIG OP1 PRESSFIT AUTO ASSY STEERING STEM.PDF	2026-08-10 03:19:51.895	2026-08-10 03:19:51.895	APPROVED
cmsmny2cb001sx8ryman2rj5s	cmsmnx5gv001fk4rygnekoqjx	N/A	N/A	2026-08-10 03:19:51.899	2026-08-10 03:19:51.899	APPROVED
cmsmny2ch001ux8ryzv5797gj	cmsmnx5i8001xk4ryatfts5bc	[object Object]	[object Object]	2026-08-10 03:19:51.905	2026-08-10 03:19:51.905	APPROVED
cmsmny2cl001wx8ry76890jsw	cmsmnx5id001zk4ry3v5on950	[object Object]	[object Object]	2026-08-10 03:19:51.909	2026-08-10 03:19:51.909	APPROVED
cmsmny2cp001yx8ry3hnhxeni	cmsmnx5ii0021k4ryqz6xequm	[object Object]	[object Object]	2026-08-10 03:19:51.913	2026-08-10 03:19:51.913	APPROVED
cmsmny2cu0020x8ryg957ah3e	cmsmnx5il0023k4rygh393x08	[object Object]	[object Object]	2026-08-10 03:19:51.918	2026-08-10 03:19:51.918	APPROVED
cmsmny2d00022x8ryjkapcw2o	cmsmnx5iv0025k4ry460c028f	[object Object]	[object Object]	2026-08-10 03:19:51.924	2026-08-10 03:19:51.924	APPROVED
cmsmny2d40024x8rypdxhdjm5	cmsmnx5j30027k4ryvn7pjq8s	N/A	N/A	2026-08-10 03:19:51.928	2026-08-10 03:19:51.928	APPROVED
cmsmny2d80026x8rycl1uei3e	cmsmnx5j90029k4rytjx553xj	N/A	N/A	2026-08-10 03:19:51.932	2026-08-10 03:19:51.932	APPROVED
cmsmny2dc0028x8rygk1zl4ep	cmsmnx5jf002bk4ry3038xkey	[object Object]	[object Object]	2026-08-10 03:19:51.936	2026-08-10 03:19:51.936	APPROVED
cmsmny2dg002ax8ry596de74n	cmsmnx5jk002dk4ry4zouhaj2	[object Object]	[object Object]	2026-08-10 03:19:51.94	2026-08-10 03:19:51.94	APPROVED
cmsmny2dk002cx8rykei4v1mz	cmsmnx5jp002fk4ry7lvq64vs	[object Object]	[object Object]	2026-08-10 03:19:51.944	2026-08-10 03:19:51.944	APPROVED
cmsmny2do002ex8ryyffqlmmr	cmsmnx5jv002hk4ryjo0btib7	[object Object]	[object Object]	2026-08-10 03:19:51.948	2026-08-10 03:19:51.948	APPROVED
cmsmny2ds002gx8ryxacir3dh	cmsmnx5k0002jk4ryxmi96y2i	[object Object]	[object Object]	2026-08-10 03:19:51.952	2026-08-10 03:19:51.952	APPROVED
cmsmny2dx002ix8ryvib19jaf	cmsmnx5k4002lk4ryg9iquz6y	[object Object]	[object Object]	2026-08-10 03:19:51.957	2026-08-10 03:19:51.957	APPROVED
cmsmny2e1002kx8ryxyxebx4t	cmsmnx5ka002nk4ryljkpvsad	[object Object]	[object Object]	2026-08-10 03:19:51.961	2026-08-10 03:19:51.961	APPROVED
cmsmny2e5002mx8ry7oo4x6aa	cmsmnx5kh002pk4rym629htu7	[object Object]	[object Object]	2026-08-10 03:19:51.965	2026-08-10 03:19:51.965	APPROVED
cmsmny2e9002ox8rypzq8e4w4	cmsmnx5kn002rk4ry4rfrh7or	[object Object]	[object Object]	2026-08-10 03:19:51.969	2026-08-10 03:19:51.969	APPROVED
cmsmny2ee002qx8ryzyf16j9d	cmsmnx5kt002tk4rys7wv3p1y	[object Object]	[object Object]	2026-08-10 03:19:51.974	2026-08-10 03:19:51.974	APPROVED
cmsmny2ei002sx8rycgan52uw	cmsmnx5ky002vk4rymkbird2g	[object Object]	[object Object]	2026-08-10 03:19:51.978	2026-08-10 03:19:51.978	APPROVED
cmsmny2et002yx8ryi2v9w6sn	cmsmnx5lh0031k4ryho8j1nn8	N/A	N/A	2026-08-10 03:19:51.989	2026-08-10 03:19:51.989	APPROVED
cmsmny2ey0030x8ryfeptqslu	cmsmnx5ln0033k4ryd0f8a8zl	N/A	N/A	2026-08-10 03:19:51.994	2026-08-10 03:19:51.994	APPROVED
cmsmny2f40032x8ry9j14g9ga	cmsmnx5ls0035k4ry8gf92hhd	N/A	N/A	2026-08-10 03:19:52	2026-08-10 03:19:52	APPROVED
cmsmny2f80034x8rygavbuu9c	cmsmnx5j90029k4rytjx553xj	N/A	N/A	2026-08-10 03:19:52.004	2026-08-10 03:19:52.004	APPROVED
cmsmny2fc0036x8ry53n7sgj6	cmsmnx5lz0039k4rybr8xx8ou	N/A	N/A	2026-08-10 03:19:52.008	2026-08-10 03:19:52.008	APPROVED
cmsmny2ff0038x8ryci9sdonw	cmsmnx5m4003bk4rygt0uyah8	N/A	N/A	2026-08-10 03:19:52.011	2026-08-10 03:19:52.011	APPROVED
cmsmny2fi003ax8ryvtjljd81	cmsmnx5j30027k4ryvn7pjq8s	N/A	N/A	2026-08-10 03:19:52.015	2026-08-10 03:19:52.015	APPROVED
cmsmny2fm003cx8ryu4ludczx	cmsmnx5mc003fk4ryq5jo9fwk	N/A	N/A	2026-08-10 03:19:52.018	2026-08-10 03:19:52.018	APPROVED
cmsmny2fr003ex8ry6xlhtkhx	cmsmnx5mg003hk4ryrd46966a	[object Object]	[object Object]	2026-08-10 03:19:52.023	2026-08-10 03:19:52.023	APPROVED
cmsmny2fw003gx8rysfoi2qf3	cmsmnx5mo003jk4ry7ymioqbz	[object Object]	[object Object]	2026-08-10 03:19:52.028	2026-08-10 03:19:52.028	APPROVED
cmsmny2fz003ix8ry755g0uex	cmsmnx5mu003lk4ryaaid3uh5	[object Object]	[object Object]	2026-08-10 03:19:52.031	2026-08-10 03:19:52.031	APPROVED
cmsmny2g2003kx8ry8oqm4f8b	cmsmnx5my003nk4ry0s10uj2s	[object Object]	[object Object]	2026-08-10 03:19:52.034	2026-08-10 03:19:52.034	APPROVED
cmsmny2g6003mx8ryckb7q7od	cmsmnx5n3003pk4ryd9255qrj	[object Object]	[object Object]	2026-08-10 03:19:52.038	2026-08-10 03:19:52.038	APPROVED
cmsmny2g9003ox8ryxzbkm75y	cmsmnx5n8003rk4ryjjywq50c	[object Object]	[object Object]	2026-08-10 03:19:52.041	2026-08-10 03:19:52.041	APPROVED
cmsmny2gc003qx8ry4g7g7odr	cmsmnx5n8003rk4ryjjywq50c	[object Object]	[object Object]	2026-08-10 03:19:52.044	2026-08-10 03:19:52.044	APPROVED
cmsmny2gg003sx8rymow7icbj	cmsmnx5ni003vk4ryj10nfsnq	N/A	N/A	2026-08-10 03:19:52.048	2026-08-10 03:19:52.048	APPROVED
cmsmny2gj003ux8ryk9dop17o	cmsmnx5no003xk4ryed2g07iu	N/A	N/A	2026-08-10 03:19:52.051	2026-08-10 03:19:52.051	APPROVED
cmsmny2gm003wx8ry8jvmxscq	cmsmnx5nt003zk4ryv2z9xd1z	N/A	N/A	2026-08-10 03:19:52.054	2026-08-10 03:19:52.054	APPROVED
cmsmny2gq003yx8ry0codcr1i	cmsmnx5ny0041k4rypx1n6694	[object Object]	[object Object]	2026-08-10 03:19:52.058	2026-08-10 03:19:52.058	APPROVED
cmsmny2gt0040x8ry59cx0v4b	cmsmnx5o30043k4ryxlpypz6z	..\\01. Design\\001. Auto Assy Steering Stem\\F - Instocker - Outstocker - Gantry\\3. PDF\\TXMACH-ASAUIN0200 GRIPPER GANTRY HGPT50.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\F - Instocker - Outstocker - Gantry\\3. PDF\\TXMACH-ASAUIN0200 GRIPPER GANTRY HGPT50.PDF	2026-08-10 03:19:52.061	2026-08-10 03:19:52.061	APPROVED
cmsmny2gx0042x8ryz5uv43b8	cmsmnx5o80045k4ryf1jkiqyw	..\\01. Design\\001. Auto Assy Steering Stem\\F - Instocker - Outstocker - Gantry\\3. PDF\\TXMACH-ASAUIN0200 GRIPPER GANTRY HGPT50.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\F - Instocker - Outstocker - Gantry\\3. PDF\\TXMACH-ASAUIN0200 GRIPPER GANTRY HGPT50.PDF	2026-08-10 03:19:52.065	2026-08-10 03:19:52.065	APPROVED
cmsmny2h10044x8ry2gz11dmy	cmsmnx5oc0047k4ry88psossy	..\\01. Design\\001. Auto Assy Steering Stem\\F - Instocker - Outstocker - Gantry\\3. PDF\\TXMACH-ASAUIN0200 GRIPPER GANTRY HGPT50.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\F - Instocker - Outstocker - Gantry\\3. PDF\\TXMACH-ASAUIN0200 GRIPPER GANTRY HGPT50.PDF	2026-08-10 03:19:52.069	2026-08-10 03:19:52.069	APPROVED
cmsmny2h50046x8ry3o954qzz	cmsmnx5oi0049k4rywfkf1hrd	..\\01. Design\\001. Auto Assy Steering Stem\\F - Instocker - Outstocker - Gantry\\3. PDF\\TXMACH-ASAUIN0200 GRIPPER GANTRY HGPT50.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\F - Instocker - Outstocker - Gantry\\3. PDF\\TXMACH-ASAUIN0200 GRIPPER GANTRY HGPT50.PDF	2026-08-10 03:19:52.073	2026-08-10 03:19:52.073	APPROVED
cmsmny2h80048x8ryvy3tkrzo	cmsmnx5om004bk4rymw78ywc9	..\\01. Design\\001. Auto Assy Steering Stem\\F - Instocker - Outstocker - Gantry\\3. PDF\\TXMACH-ASAUIN0200 GRIPPER GANTRY HGPT50.PDF	..\\01. Design\\001. Auto Assy Steering Stem\\F - Instocker - Outstocker - Gantry\\3. PDF\\TXMACH-ASAUIN0200 GRIPPER GANTRY HGPT50.PDF	2026-08-10 03:19:52.076	2026-08-10 03:19:52.076	APPROVED
cmsmny2hb004ax8rynxwyr9ve	cmsmnx5lh0031k4ryho8j1nn8	N/A	N/A	2026-08-10 03:19:52.079	2026-08-10 03:19:52.079	APPROVED
cmsmny2he004cx8ry1po4mgqy	cmsmnx5ln0033k4ryd0f8a8zl	N/A	N/A	2026-08-10 03:19:52.082	2026-08-10 03:19:52.082	APPROVED
cmsmny2hi004ex8ryyermm8pu	cmsmnx5ls0035k4ry8gf92hhd	N/A	N/A	2026-08-10 03:19:52.086	2026-08-10 03:19:52.086	APPROVED
cmsmny2hl004gx8ryxb7qaylq	cmsmnx5j90029k4rytjx553xj	N/A	N/A	2026-08-10 03:19:52.089	2026-08-10 03:19:52.089	APPROVED
cmsmny2hp004ix8ry1kd6cwfe	cmsmnx5j30027k4ryvn7pjq8s	N/A	N/A	2026-08-10 03:19:52.093	2026-08-10 03:19:52.093	APPROVED
cmsmny2ht004kx8ry0qoe7tl6	cmsmnx5pg004nk4rywhs58iqx	[object Object]	[object Object]	2026-08-10 03:19:52.097	2026-08-10 03:19:52.097	APPROVED
cmsmny2hy004mx8ryors31pu9	cmsmnx5pm004pk4ry4vpxeron	[object Object]	[object Object]	2026-08-10 03:19:52.102	2026-08-10 03:19:52.102	APPROVED
cmsmny2i3004ox8ryz8krbg5m	cmsmnx5pt004rk4ry84lrfqt2	[object Object]	[object Object]	2026-08-10 03:19:52.107	2026-08-10 03:19:52.107	APPROVED
cmsmny2i8004qx8rya7vucr4g	cmsmnx5pz004tk4ry2tmdetc5	[object Object]	[object Object]	2026-08-10 03:19:52.112	2026-08-10 03:19:52.112	APPROVED
cmsmny2ib004sx8rytpo0wmow	cmsmnx5q4004vk4rysernzd9t	[object Object]	[object Object]	2026-08-10 03:19:52.115	2026-08-10 03:19:52.115	APPROVED
cmsmny2ie004ux8rynerdoq0r	cmsmnx5qa004xk4ryysruwpxq	[object Object]	[object Object]	2026-08-10 03:19:52.118	2026-08-10 03:19:52.118	APPROVED
cmsmny2ih004wx8ryil979thg	cmsmnx5qg004zk4ry5uk934wx	[object Object]	[object Object]	2026-08-10 03:19:52.121	2026-08-10 03:19:52.121	APPROVED
cmsmny2il004yx8ry76bd2wox	cmsmnx5qm0051k4rymkf2ixjo	[object Object]	[object Object]	2026-08-10 03:19:52.125	2026-08-10 03:19:52.125	APPROVED
cmsmny2io0050x8ry2j7hbc9r	cmsmnx5qv0053k4rypc5ypm6g	[object Object]	[object Object]	2026-08-10 03:19:52.128	2026-08-10 03:19:52.128	APPROVED
cmsmvf4y500001kryb5claabb	cmsmnx5re0057k4rynl41v6ss	/uploads/ASSEMBLY DEAL9 2.pdf	/uploads/ASSEMBLY DEAL9 2.pdf	2026-08-10 06:49:05.742	2026-08-10 06:49:42.682	APPROVED
cmsmw3ojo00012wrylv2b43sv	cmsmw3oj800002wrygy85hepm	\N	\N	2026-08-10 07:08:10.868	2026-08-10 07:08:10.868	APPROVED
cmsmw4n0y00051kryv9og387d	cmsmw3oj800002wrygy85hepm	/uploads/ASSEMBLY DEAL9 2.pdf	/uploads/ASSEMBLY DEAL9 2.pdf	2026-08-10 07:08:55.57	2026-08-10 07:09:36.832	APPROVED
cmsmw7h39000a1kry6yd4hcb8	cmsmw3oj800002wrygy85hepm	/uploads/ASSEMBLY DEAL9 2.pdf	/uploads/ASSEMBLY DEAL9 2.pdf	2026-08-10 07:11:07.845	2026-08-10 07:11:39.979	APPROVED
cmsmwejgc000f1kryqrwjxl1v	cmsmw3oj800002wrygy85hepm	/uploads/ASSEMBLYDEAL92.pdf	/uploads/ASSEMBLYDEAL92.pdf	2026-08-10 07:16:37.5	2026-08-10 07:23:24.793	APPROVED
cmsmywc640001qgry17n1a0sq	cmsmywc410000qgry7n41ea3h	/uploads/ASSEMBLYDEAL92.pdf	/uploads/ASSEMBLYDEAL92.pdf	2026-08-10 08:26:27.1	2026-08-10 08:26:27.1	APPROVED
cmsmz8jzm0000n4rydmaf3rut	cmsmywc410000qgry7n41ea3h	/uploads/ASSEMBLYDEAL92.pdf	/uploads/ASSEMBLYDEAL92.pdf	2026-08-10 08:35:57.106	2026-08-11 00:50:41.865	APPROVED
cmso3koyn0000zkry9jgjplsk	cmsmywc410000qgry7n41ea3h	/uploads/ASSEMBLYDEAL92.pdf	/uploads/ASSEMBLYDEAL92.pdf	2026-08-11 03:25:08.063	2026-08-11 03:25:25.153	APPROVED
cmsofacv70001xcryk8i2ttl8	cmsofacu60000xcryggbxo206	/uploads/ASSEMBLYDEAL92.pdf	/uploads/ASSEMBLYDEAL92.pdf	2026-08-11 08:53:01.219	2026-08-11 08:53:01.219	APPROVED
\.


--
-- Data for Name: inventory_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_log (id, design_id, changed_by_id, prev_min_stock, new_min_stock, prev_act_stock, new_act_stock, indicator, created_at) FROM stdin;
cmsnyifzo0005nkrybtrvi6wz	cmsmywc410000qgry7n41ea3h	cmsmnx54d0004k4rytkb9u3ju	4	4	10	10	GREEN	2026-08-11 01:03:25.044
cmsnyjcdi0006nkry4mju4jn5	cmsmnx5lh0031k4ryho8j1nn8	cmsmnx54d0004k4rytkb9u3ju	0	0	0	1	GREEN	2026-08-11 01:04:07.014
cmsnyjl6t0007nkry3l6uovh9	cmsmnx5n8003rk4ryjjywq50c	cmsmnx54d0004k4rytkb9u3ju	0	0	0	1	GREEN	2026-08-11 01:04:18.437
\.


--
-- Data for Name: line; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.line (id, line_name, line_code, created_at, updated_at) FROM stdin;
cmsmnx5d10008k4ry0qyh39aq	Auto Assy Steering Stem	AUTO_ASSY_STEERING_STEM	2026-08-10 03:19:09.157	2026-08-10 03:19:09.157
cmsmnx5da0009k4ryllzp1y1l	Manual Assy Steering Stem	MANUAL_ASSY_STEERING_STEM	2026-08-10 03:19:09.166	2026-08-10 03:19:09.166
cmsmnx5de000ak4ryl42iiu0d	2CF - 2MD	2CF_-_2MD	2026-08-10 03:19:09.17	2026-08-10 03:19:09.17
cmsmnx5di000bk4rynm6lrwgk	D14	D14	2026-08-10 03:19:09.174	2026-08-10 03:19:09.174
cmsmnx5dk000ck4ryu4zqqlb3	D40	D40	2026-08-10 03:19:09.176	2026-08-10 03:19:09.176
cmsmnx5dn000dk4ryt3xvtoh8	T86	T86	2026-08-10 03:19:09.179	2026-08-10 03:19:09.179
cmsmnx5dq000ek4ry4exeuyul	D38-Hub Clutch	D38-HUB_CLUTCH	2026-08-10 03:19:09.182	2026-08-10 03:19:09.182
cmsmnx5dt000fk4rykrnjk6xs	D80-Hub Front	D80-HUB_FRONT	2026-08-10 03:19:09.185	2026-08-10 03:19:09.185
cmsmnx5dw000gk4ryux68a87t	UB Robot 5	UB_ROBOT_5	2026-08-10 03:19:09.188	2026-08-10 03:19:09.188
cmsmnx5dz000hk4ry3byhigy0	UB 6-7	UB_6-7	2026-08-10 03:19:09.191	2026-08-10 03:19:09.191
cmsmnx5e2000ik4ryrkwxovnz	UB Robot 1-4	UB_ROBOT_1-4	2026-08-10 03:19:09.194	2026-08-10 03:19:09.194
cmsmny2870004x8rys30tumh4	Auto Assy Steering Stem	AUTO_ASSY_STEERING_STEM	2026-08-10 03:19:51.751	2026-08-10 03:19:51.751
cmsmny28b0005x8ryuykmqeln	Manual Assy Steering Stem	MANUAL_ASSY_STEERING_STEM	2026-08-10 03:19:51.755	2026-08-10 03:19:51.755
cmsmny28h0006x8rycgkw1mlb	2CF - 2MD	2CF_-_2MD	2026-08-10 03:19:51.761	2026-08-10 03:19:51.761
cmsmny28k0007x8rymq3m9dfy	D14	D14	2026-08-10 03:19:51.764	2026-08-10 03:19:51.764
cmsmny28n0008x8ryh6wlcyn3	D40	D40	2026-08-10 03:19:51.767	2026-08-10 03:19:51.767
cmsmny28p0009x8ryubn868qo	T86	T86	2026-08-10 03:19:51.769	2026-08-10 03:19:51.769
cmsmny28q000ax8ry4jnzny24	D38-Hub Clutch	D38-HUB_CLUTCH	2026-08-10 03:19:51.77	2026-08-10 03:19:51.77
cmsmny28s000bx8ryjmta1qhi	D80-Hub Front	D80-HUB_FRONT	2026-08-10 03:19:51.772	2026-08-10 03:19:51.772
cmsmny28u000cx8ry9qta3wn5	UB Robot 5	UB_ROBOT_5	2026-08-10 03:19:51.774	2026-08-10 03:19:51.774
cmsmny28w000dx8ryvd87xp4m	UB 6-7	UB_6-7	2026-08-10 03:19:51.776	2026-08-10 03:19:51.776
cmsmny28x000ex8ry29mkophl	UB Robot 1-4	UB_ROBOT_1-4	2026-08-10 03:19:51.777	2026-08-10 03:19:51.777
cmso9xzqf000bc0ry0d2wkxod	TEST	TEST	2026-08-11 06:23:26.247	2026-08-11 06:23:26.247
\.


--
-- Data for Name: notification; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notification (id, type, title, message, is_read, design_id, user_id, created_at) FROM stdin;
cmsmvfm4g00031krybr6jdyg5	WAITING_APPROVAL	📋 Approval Waiting: Dept Head	Section Head approved revision for N/A. Awaiting your final review.	f	cmsmnx5re0057k4rynl41v6ss	cmsmnx55z0006k4ryofcou2hl	2026-08-10 06:49:28
cmsmvfxge00041kryfg9i7glq	INVENTORY_GREEN	✅ Revision Approved (Completed)	Your revision request for N/A was fully approved and updated in the system.	f	cmsmnx5re0057k4rynl41v6ss	cmsmnx54d0004k4rytkb9u3ju	2026-08-10 06:49:42.686
cmsmw5c4i00081kryx9al0tya	WAITING_APPROVAL	📋 Approval Waiting: Dept Head	Section Head approved revision for REG-TEST-999. Awaiting your final review.	f	cmsmw3oj800002wrygy85hepm	cmsmnx55z0006k4ryofcou2hl	2026-08-10 07:09:28.098
cmsmw5iv700091kryzb1kk6zz	INVENTORY_GREEN	✅ Revision Approved (Completed)	Your revision request for REG-TEST-999 was fully approved and updated in the system.	f	cmsmw3oj800002wrygy85hepm	cmsmnx54d0004k4rytkb9u3ju	2026-08-10 07:09:36.835
cmsmw81l2000d1krydu39xojf	WAITING_APPROVAL	📋 Approval Waiting: Dept Head	Section Head approved revision for REG-TEST-999. Awaiting your final review.	f	cmsmw3oj800002wrygy85hepm	cmsmnx55z0006k4ryofcou2hl	2026-08-10 07:11:34.406
cmsmw85vz000e1kryjnb8wjr9	INVENTORY_GREEN	✅ Revision Approved (Completed)	Your revision request for REG-TEST-999 was fully approved and updated in the system.	f	cmsmw3oj800002wrygy85hepm	cmsmnx54d0004k4rytkb9u3ju	2026-08-10 07:11:39.983
cmsmwn29w000i1krymqwislyy	WAITING_APPROVAL	📋 Approval Waiting: Dept Head	Section Head approved revision for REG-TEST-999. Awaiting your final review.	f	cmsmw3oj800002wrygy85hepm	cmsmnx55z0006k4ryofcou2hl	2026-08-10 07:23:15.14
cmsmwn9q6000j1kry04f47bgp	INVENTORY_GREEN	✅ Revision Approved (Completed)	Your revision request for REG-TEST-999 was fully approved and updated in the system.	f	cmsmw3oj800002wrygy85hepm	cmsmnx54d0004k4rytkb9u3ju	2026-08-10 07:23:24.798
cmsny1gyf0001nkryiwbh5kgi	ABNORMALITY_OPEN	Abnormality Dilaporkan: xx	[RUSAK] Mangkrak...	f	cmsmywc410000qgry7n41ea3h	cmsmnx55w0005k4ryyeh79fx6	2026-08-11 00:50:13.143
cmsny1gyk0002nkrymlz8hbs7	ABNORMALITY_OPEN	Abnormality Dilaporkan: xx	[RUSAK] Mangkrak...	f	cmsmywc410000qgry7n41ea3h	cmsmnx55z0006k4ryofcou2hl	2026-08-11 00:50:13.148
cmsny1w7n0003nkry7qijervp	WAITING_APPROVAL	📋 Approval Waiting: Dept Head	Section Head approved revision for xx. Awaiting your final review.	f	cmsmywc410000qgry7n41ea3h	cmsmnx55z0006k4ryofcou2hl	2026-08-11 00:50:32.915
cmsny234c0004nkry0zevfqim	INVENTORY_GREEN	✅ Revision Approved (Completed)	Your revision request for xx was fully approved and updated in the system.	f	cmsmywc410000qgry7n41ea3h	cmsmnx54d0004k4rytkb9u3ju	2026-08-11 00:50:41.868
cmso3kx2s0003zkryteu1xe8y	WAITING_APPROVAL	📋 Approval Waiting: Dept Head	Section Head approved revision for xx. Awaiting your final review.	f	cmsmywc410000qgry7n41ea3h	cmsmnx55z0006k4ryofcou2hl	2026-08-11 03:25:18.58
cmso3l25g0004zkryzgkgmcaa	INVENTORY_GREEN	✅ Revision Approved (Completed)	Your revision request for xx was fully approved and updated in the system.	f	cmsmywc410000qgry7n41ea3h	cmsmnx54d0004k4rytkb9u3ju	2026-08-11 03:25:25.156
cmso6b6w20000c0ryoliddq2l	WAITING_APPROVAL	📋 Approval Waiting: Dept Head	Section Head approved revision for HOLLOW 20X30X1290. Awaiting your final review.	f	cmsmnx5n8003rk4ryjjywq50c	cmsmnx55z0006k4ryofcou2hl	2026-08-11 04:41:43.586
cmso6bcvz0001c0ryxlm5g1qh	INVENTORY_GREEN	✅ Revision Approved (Completed)	Your revision request for HOLLOW 20X30X1290 was fully approved and updated in the system.	f	cmsmnx5n8003rk4ryjjywq50c	cmsmnx54d0004k4rytkb9u3ju	2026-08-11 04:41:51.359
\.


--
-- Data for Name: process; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.process (id, name, code, created_at, updated_at) FROM stdin;
cmsmnx5e5000jk4ryvws40kig	OP#1 (PressFit)	OP#1_(PRESSFIT)	2026-08-10 03:19:09.197	2026-08-10 03:19:09.197
cmsmnx5e8000kk4ryn7401ibb	Robot Nachi	ROBOT_NACHI	2026-08-10 03:19:09.201	2026-08-10 03:19:09.201
cmsmnx5eb000lk4rym8wbfqav	OP#2 (Welding)	OP#2_(WELDING)	2026-08-10 03:19:09.203	2026-08-10 03:19:09.203
cmsmnx5ed000mk4ryf1ao1os9	Instocker - Outstocker - Gantry	INSTOCKER_-_OUTSTOCKER_-_GANTRY	2026-08-10 03:19:09.205	2026-08-10 03:19:09.205
cmsmnx5ee000nk4ryu3suzdaj	OP#4 (Assy Cone Race)	OP#4_(ASSY_CONE_RACE)	2026-08-10 03:19:09.206	2026-08-10 03:19:09.206
cmsmnx5eg000ok4ryqqqjhar2	OP#1 (Press Fit)	OP#1_(PRESS_FIT)	2026-08-10 03:19:09.208	2026-08-10 03:19:09.208
cmsmnx5ei000pk4rytzy7wcwf	Checking Bolt	CHECKING_BOLT	2026-08-10 03:19:09.21	2026-08-10 03:19:09.21
cmsmnx5ek000qk4ryinq2mp7a	Broaching	BROACHING	2026-08-10 03:19:09.212	2026-08-10 03:19:09.212
cmsmnx5em000rk4ryxz38ehi5	OP#2	OP#2	2026-08-10 03:19:09.214	2026-08-10 03:19:09.214
cmsmnx5eo000sk4ryjtxpdmsx	OP#2 , OP#3	OP#2_,_OP#3	2026-08-10 03:19:09.216	2026-08-10 03:19:09.216
cmsmnx5er000tk4rys58bbbbn	OP#4	OP#4	2026-08-10 03:19:09.219	2026-08-10 03:19:09.219
cmsmnx5es000uk4ryz4xmpp3q	OP#1	OP#1	2026-08-10 03:19:09.22	2026-08-10 03:19:09.22
cmsmny28z000fx8ryw6wwtf9q	OP#1 (PressFit)	OP#1_(PRESSFIT)	2026-08-10 03:19:51.779	2026-08-10 03:19:51.779
cmsmny291000gx8rywz21m3qc	Robot Nachi	ROBOT_NACHI	2026-08-10 03:19:51.781	2026-08-10 03:19:51.781
cmsmny293000hx8rythnoikpe	OP#2 (Welding)	OP#2_(WELDING)	2026-08-10 03:19:51.783	2026-08-10 03:19:51.783
cmsmny294000ix8ryida5pmr8	Instocker - Outstocker - Gantry	INSTOCKER_-_OUTSTOCKER_-_GANTRY	2026-08-10 03:19:51.784	2026-08-10 03:19:51.784
cmsmny296000jx8ryowtuwm3c	OP#4 (Assy Cone Race)	OP#4_(ASSY_CONE_RACE)	2026-08-10 03:19:51.786	2026-08-10 03:19:51.786
cmsmny298000kx8ry9h6du1i0	OP#1 (Press Fit)	OP#1_(PRESS_FIT)	2026-08-10 03:19:51.788	2026-08-10 03:19:51.788
cmsmny299000lx8ryu2herddt	Checking Bolt	CHECKING_BOLT	2026-08-10 03:19:51.789	2026-08-10 03:19:51.789
cmsmny29b000mx8ryc7w08kpg	Broaching	BROACHING	2026-08-10 03:19:51.791	2026-08-10 03:19:51.791
cmsmny29c000nx8rye0mxefty	OP#2	OP#2	2026-08-10 03:19:51.792	2026-08-10 03:19:51.792
cmsmny29e000ox8ry72b1ek1x	OP#2 , OP#3	OP#2_,_OP#3	2026-08-10 03:19:51.794	2026-08-10 03:19:51.794
cmsmny29f000px8ryfc4us76u	OP#4	OP#4	2026-08-10 03:19:51.795	2026-08-10 03:19:51.795
cmsmny29g000qx8ry6pwn0keb	OP#1	OP#1	2026-08-10 03:19:51.796	2026-08-10 03:19:51.796
cmso96q6b0002c0ryq4jy2v6r	ROTOR	ROTOR	2026-08-11 06:02:14.147	2026-08-11 06:02:14.147
cmso9xzqk000cc0ryn8marvyw	TEST	TEST	2026-08-11 06:23:26.252	2026-08-11 06:23:26.252
\.


--
-- Data for Name: revision_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.revision_history (id, design_id, rev_status, description, changed_by_id, vendor_id, po_number, cost, lead_time, approved_by_name, "3d_path", "3d_loc", created_at, "2d_loc", "2d_path") FROM stdin;
cmsmvf4za00021krymzynzcyz	cmsmnx5re0057k4rynl41v6ss	1	Patah	cmsmnx54d0004k4rytkb9u3ju	default-vendor	PO/2026/XAI35	160000	3	Rahmat K. (Dept Head)	\N	\N	2026-08-10 06:49:05.783	\N	\N
cmsmw4n1j00071kryg0msh09u	cmsmw3oj800002wrygy85hepm	1	Busung lapar	cmsmnx54d0004k4rytkb9u3ju	default-vendor	XXX	1600000	1	Rahmat K. (Dept Head)	\N	\N	2026-08-10 07:08:55.591	\N	\N
cmsmw7h3q000c1kryd1vqy8gd	cmsmw3oj800002wrygy85hepm	3	Twst	cmsmnx54d0004k4rytkb9u3ju	default-vendor	x	2626660	1	Rahmat K. (Dept Head)	\N	\N	2026-08-10 07:11:07.862	\N	\N
cmsmwejhs000h1krybtksaa9n	cmsmw3oj800002wrygy85hepm	5	Testing PDF upload failure debug	cmsmnx54d0004k4rytkb9u3ju	default-vendor	\N	0	1	Rahmat K. (Dept Head)	\N	\N	2026-08-10 07:16:37.552	\N	\N
cmsmywc6i0002qgry0df6txw2	cmsmywc410000qgry7n41ea3h	0	Initial Release	cmsmnx54d0004k4rytkb9u3ju	default-vendor	PO/2026/XYZ/3535	5600000	2	System Admin (PIC)	\N	\N	2026-08-10 08:26:27.114	\N	\N
cmsmz8k0l0002n4rysjkc8e7p	cmsmywc410000qgry7n41ea3h	1	Mangkrak	cmsmnx54d0004k4rytkb9u3ju	\N	\N	0	1	Rahmat K. (Dept Head)	\N	\N	2026-08-10 08:35:57.141	\N	\N
cmso3kozn0002zkryxfw1ybma	cmsmywc410000qgry7n41ea3h	3	3D	cmsmnx54d0004k4rytkb9u3ju	default-vendor	\N	2660000	1	Rahmat K. (Dept Head)	/uploads/38285860_009-RACE_BLANK__C_V_OUTER(trigger_ke_dies).stp	/uploads/38285860_009-RACE_BLANK__C_V_OUTER(trigger_ke_dies).stp	2026-08-11 03:25:08.099	/uploads/ASSEMBLYDEAL92.pdf	/uploads/ASSEMBLYDEAL92.pdf
cmsofacvf0002xcryi9xov475	cmsofacu60000xcryggbxo206	0	Initial Release	cmsmnx54d0004k4rytkb9u3ju	default-vendor	PO/2026/XYZ/002	190000	1	System PIC	/uploads/UDF_CS_K1ZG_RH_-_Revisi_8_(_Flashless_).IGS	/uploads/UDF_CS_K1ZG_RH_-_Revisi_8_(_Flashless_).IGS	2026-08-11 08:53:01.227	/uploads/ASSEMBLYDEAL92.pdf	/uploads/ASSEMBLYDEAL92.pdf
\.


--
-- Data for Name: role; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.role (id, name, created_at, updated_at) FROM stdin;
cmsmnx4z40000k4ry175ott2i	PE_JIG_FIXTURE	2026-08-10 03:19:08.656	2026-08-10 03:19:08.656
cmsmnx5060001k4ry4anmmoxx	PE_SECTION_HEAD	2026-08-10 03:19:08.694	2026-08-10 03:19:08.694
cmsmnx50j0002k4ry122hxvdm	PE_DEPT_HEAD	2026-08-10 03:19:08.707	2026-08-10 03:19:08.707
cmsmnx50p0003k4ry1q3ejewb	TAMU	2026-08-10 03:19:08.713	2026-08-10 03:19:08.713
\.


--
-- Data for Name: user; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."user" (id, name, npk, email, password, role_id, created_at, updated_at) FROM stdin;
cmsmnx54d0004k4rytkb9u3ju	Admin (PIC)	NPK001	admin	$2b$10$DVu63JHRSVwBIkrtOX3wsuZrGj7CfXj6uSLifwjpD8MvIMJKT86ZW	cmsmnx4z40000k4ry175ott2i	2026-08-10 03:19:08.845	2026-08-10 03:19:51.641
cmsmnx55w0005k4ryyeh79fx6	M. Fariedl (Section Head)	NPK002	sec@example.com	$2b$10$ggX3FVUovPnP.1MSY9GQturJ2dCJicCYySGmCQ3mYo.vgA0DDibou	cmsmnx5060001k4ry4anmmoxx	2026-08-10 03:19:08.9	2026-08-10 03:19:51.649
cmsmnx55z0006k4ryofcou2hl	Rahmat K. (Dept Head)	NPK003	dept@example.com	$2b$10$ggX3FVUovPnP.1MSY9GQturJ2dCJicCYySGmCQ3mYo.vgA0DDibou	cmsmnx50j0002k4ry122hxvdm	2026-08-10 03:19:08.903	2026-08-10 03:19:51.651
cmsmnx5610007k4ry4yrzn3r8	Tamu (Visitor)	NPK004	guest@example.com	$2b$10$ggX3FVUovPnP.1MSY9GQturJ2dCJicCYySGmCQ3mYo.vgA0DDibou	cmsmnx50p0003k4ry1q3ejewb	2026-08-10 03:19:08.905	2026-08-10 03:19:51.653
\.


--
-- Data for Name: vendor; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vendor (id, name, code, created_at, updated_at) FROM stdin;
default-vendor	Internal Workshop PE	VND001	2026-08-10 03:19:08.913	2026-08-10 03:19:08.913
\.


--
-- Name: abnormality abnormality_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.abnormality
    ADD CONSTRAINT abnormality_pkey PRIMARY KEY (id);


--
-- Name: approval approval_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval
    ADD CONSTRAINT approval_pkey PRIMARY KEY (id);


--
-- Name: design design_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.design
    ADD CONSTRAINT design_pkey PRIMARY KEY (id);


--
-- Name: document document_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_pkey PRIMARY KEY (id);


--
-- Name: inventory_log inventory_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_log
    ADD CONSTRAINT inventory_log_pkey PRIMARY KEY (id);


--
-- Name: line line_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.line
    ADD CONSTRAINT line_pkey PRIMARY KEY (id);


--
-- Name: notification notification_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_pkey PRIMARY KEY (id);


--
-- Name: process process_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.process
    ADD CONSTRAINT process_pkey PRIMARY KEY (id);


--
-- Name: revision_history revision_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.revision_history
    ADD CONSTRAINT revision_history_pkey PRIMARY KEY (id);


--
-- Name: role role_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_pkey PRIMARY KEY (id);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: vendor vendor_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor
    ADD CONSTRAINT vendor_pkey PRIMARY KEY (id);


--
-- Name: design_no_reg_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX design_no_reg_key ON public.design USING btree (no_reg);


--
-- Name: role_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX role_name_key ON public.role USING btree (name);


--
-- Name: user_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX user_email_key ON public."user" USING btree (email);


--
-- Name: user_npk_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX user_npk_key ON public."user" USING btree (npk);


--
-- Name: abnormality abnormality_design_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.abnormality
    ADD CONSTRAINT abnormality_design_id_fkey FOREIGN KEY (design_id) REFERENCES public.design(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: abnormality abnormality_reported_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.abnormality
    ADD CONSTRAINT abnormality_reported_by_id_fkey FOREIGN KEY (reported_by_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: approval approval_dept_head_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval
    ADD CONSTRAINT approval_dept_head_id_fkey FOREIGN KEY (dept_head_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: approval approval_design_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval
    ADD CONSTRAINT approval_design_id_fkey FOREIGN KEY (design_id) REFERENCES public.design(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: approval approval_section_head_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval
    ADD CONSTRAINT approval_section_head_id_fkey FOREIGN KEY (section_head_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: approval approval_submitted_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval
    ADD CONSTRAINT approval_submitted_by_id_fkey FOREIGN KEY (submitted_by_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: design design_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.design
    ADD CONSTRAINT design_line_id_fkey FOREIGN KEY (line_id) REFERENCES public.line(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: design design_process_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.design
    ADD CONSTRAINT design_process_id_fkey FOREIGN KEY (process_id) REFERENCES public.process(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: design design_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.design
    ADD CONSTRAINT design_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendor(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: document document_design_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_design_id_fkey FOREIGN KEY (design_id) REFERENCES public.design(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_log inventory_log_changed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_log
    ADD CONSTRAINT inventory_log_changed_by_id_fkey FOREIGN KEY (changed_by_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_log inventory_log_design_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_log
    ADD CONSTRAINT inventory_log_design_id_fkey FOREIGN KEY (design_id) REFERENCES public.design(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: notification notification_design_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_design_id_fkey FOREIGN KEY (design_id) REFERENCES public.design(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: notification notification_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: revision_history revision_history_changed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.revision_history
    ADD CONSTRAINT revision_history_changed_by_id_fkey FOREIGN KEY (changed_by_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: revision_history revision_history_design_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.revision_history
    ADD CONSTRAINT revision_history_design_id_fkey FOREIGN KEY (design_id) REFERENCES public.design(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: revision_history revision_history_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.revision_history
    ADD CONSTRAINT revision_history_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendor(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: user user_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict Uker7W8v1eqxvFFN4JsySjMDr5lt6235zaGdAn9Qyj5Pzd9ZelWoDsId1lMipHh

