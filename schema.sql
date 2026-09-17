--
-- PostgreSQL database dump
--

\restrict JOqNrzDO6BFTP4TeUKzOiCo3Xgng1WJMIGLekTrBmcYeInmiJ4g56yfDta22D3B

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: availability; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.availability (
    availability_id integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    day_id integer NOT NULL,
    employee_id integer NOT NULL,
    CONSTRAINT availability_check CHECK ((end_time > start_time))
);


ALTER TABLE public.availability OWNER TO postgres;

--
-- Name: availability_availability_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.availability_availability_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.availability_availability_id_seq OWNER TO postgres;

--
-- Name: availability_availability_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.availability_availability_id_seq OWNED BY public.availability.availability_id;


--
-- Name: class; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.class (
    class_id integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    employee_id integer NOT NULL,
    room_id integer NOT NULL,
    section_id integer NOT NULL,
    course_code character varying(20) NOT NULL,
    day_id integer NOT NULL,
    schedule_id integer NOT NULL,
    time_range tsrange GENERATED ALWAYS AS (tsrange(('2000-01-01'::date + start_time), ('2000-01-01'::date + end_time))) STORED,
    CONSTRAINT class_check CHECK ((end_time > start_time))
);


ALTER TABLE public.class OWNER TO postgres;

--
-- Name: class_class_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.class_class_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.class_class_id_seq OWNER TO postgres;

--
-- Name: class_class_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.class_class_id_seq OWNED BY public.class.class_id;


--
-- Name: course; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.course (
    course_code character varying(20) NOT NULL,
    course_description character varying(255) NOT NULL,
    course_type_id integer NOT NULL
);


ALTER TABLE public.course OWNER TO postgres;

--
-- Name: course_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.course_type (
    course_type_id integer NOT NULL,
    course_type_description character varying(100) NOT NULL,
    total_hours numeric(4,2) NOT NULL,
    CONSTRAINT course_type_total_hours_check CHECK ((total_hours > (0)::numeric))
);


ALTER TABLE public.course_type OWNER TO postgres;

--
-- Name: course_type_course_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.course_type_course_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.course_type_course_type_id_seq OWNER TO postgres;

--
-- Name: course_type_course_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.course_type_course_type_id_seq OWNED BY public.course_type.course_type_id;


--
-- Name: curriculum; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.curriculum (
    curriculum_id integer NOT NULL,
    year_level character varying(20) NOT NULL,
    program_id integer NOT NULL,
    course_code character varying(20) NOT NULL
);


ALTER TABLE public.curriculum OWNER TO postgres;

--
-- Name: curriculum_curriculum_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.curriculum_curriculum_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.curriculum_curriculum_id_seq OWNER TO postgres;

--
-- Name: curriculum_curriculum_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.curriculum_curriculum_id_seq OWNED BY public.curriculum.curriculum_id;


--
-- Name: day; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.day (
    day_id integer NOT NULL,
    name character varying(20) NOT NULL,
    CONSTRAINT day_name_check CHECK (((name)::text = ANY ((ARRAY['Monday'::character varying, 'Tuesday'::character varying, 'Wednesday'::character varying, 'Thursday'::character varying, 'Friday'::character varying, 'Saturday'::character varying, 'Sunday'::character varying])::text[])))
);


ALTER TABLE public.day OWNER TO postgres;

--
-- Name: day_day_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.day_day_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.day_day_id_seq OWNER TO postgres;

--
-- Name: day_day_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.day_day_id_seq OWNED BY public.day.day_id;


--
-- Name: employee; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee (
    employee_id integer NOT NULL,
    department character varying(100),
    lname character varying(100) NOT NULL,
    mname character varying(100),
    fname character varying(100) NOT NULL,
    name character varying(255) GENERATED ALWAYS AS (((((fname)::text || ' '::text) || COALESCE(((mname)::text || ' '::text), ''::text)) || (lname)::text)) STORED,
    "position" character varying(100),
    username character varying(50),
    max_hours_per_day numeric(4,2),
    max_hours_per_week numeric(4,2)
);


ALTER TABLE public.employee OWNER TO postgres;

--
-- Name: employee_employee_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.employee_employee_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employee_employee_id_seq OWNER TO postgres;

--
-- Name: employee_employee_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employee_employee_id_seq OWNED BY public.employee.employee_id;


--
-- Name: login; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.login (
    id integer NOT NULL,
    password_hash character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.login OWNER TO postgres;

--
-- Name: login_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.login_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.login_id_seq OWNER TO postgres;

--
-- Name: login_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.login_id_seq OWNED BY public.login.id;


--
-- Name: program; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.program (
    program_id integer NOT NULL,
    description character varying(150) NOT NULL
);


ALTER TABLE public.program OWNER TO postgres;

--
-- Name: program_program_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.program_program_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.program_program_id_seq OWNER TO postgres;

--
-- Name: program_program_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.program_program_id_seq OWNED BY public.program.program_id;


--
-- Name: room; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.room (
    room_id integer NOT NULL,
    room_number character varying(20) NOT NULL,
    capacity integer NOT NULL,
    type character varying(50),
    CONSTRAINT room_capacity_check CHECK ((capacity > 0))
);


ALTER TABLE public.room OWNER TO postgres;

--
-- Name: room_room_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.room_room_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.room_room_id_seq OWNER TO postgres;

--
-- Name: room_room_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.room_room_id_seq OWNED BY public.room.room_id;


--
-- Name: schedule; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.schedule (
    schedule_id integer NOT NULL,
    academic_year character varying(20) NOT NULL,
    school_term character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT schedule_check CHECK ((end_date > start_date)),
    CONSTRAINT schedule_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'archived'::character varying])::text[])))
);


ALTER TABLE public.schedule OWNER TO postgres;

--
-- Name: schedule_schedule_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.schedule_schedule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.schedule_schedule_id_seq OWNER TO postgres;

--
-- Name: schedule_schedule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.schedule_schedule_id_seq OWNED BY public.schedule.schedule_id;


--
-- Name: section; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.section (
    section_id integer NOT NULL,
    number_of_students integer NOT NULL,
    year_level character varying(20) NOT NULL,
    program_id integer NOT NULL,
    section_name character varying(20),
    CONSTRAINT section_number_of_students_check CHECK ((number_of_students > 0))
);


ALTER TABLE public.section OWNER TO postgres;

--
-- Name: section_section_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.section_section_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.section_section_id_seq OWNER TO postgres;

--
-- Name: section_section_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.section_section_id_seq OWNED BY public.section.section_id;


--
-- Name: user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."user" (
    username character varying(50) NOT NULL,
    password character varying(255) NOT NULL
);


ALTER TABLE public."user" OWNER TO postgres;

--
-- Name: availability availability_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.availability ALTER COLUMN availability_id SET DEFAULT nextval('public.availability_availability_id_seq'::regclass);


--
-- Name: class class_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class ALTER COLUMN class_id SET DEFAULT nextval('public.class_class_id_seq'::regclass);


--
-- Name: course_type course_type_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_type ALTER COLUMN course_type_id SET DEFAULT nextval('public.course_type_course_type_id_seq'::regclass);


--
-- Name: curriculum curriculum_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.curriculum ALTER COLUMN curriculum_id SET DEFAULT nextval('public.curriculum_curriculum_id_seq'::regclass);


--
-- Name: day day_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.day ALTER COLUMN day_id SET DEFAULT nextval('public.day_day_id_seq'::regclass);


--
-- Name: employee employee_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee ALTER COLUMN employee_id SET DEFAULT nextval('public.employee_employee_id_seq'::regclass);


--
-- Name: login id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login ALTER COLUMN id SET DEFAULT nextval('public.login_id_seq'::regclass);


--
-- Name: program program_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program ALTER COLUMN program_id SET DEFAULT nextval('public.program_program_id_seq'::regclass);


--
-- Name: room room_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.room ALTER COLUMN room_id SET DEFAULT nextval('public.room_room_id_seq'::regclass);


--
-- Name: schedule schedule_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedule ALTER COLUMN schedule_id SET DEFAULT nextval('public.schedule_schedule_id_seq'::regclass);


--
-- Name: section section_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.section ALTER COLUMN section_id SET DEFAULT nextval('public.section_section_id_seq'::regclass);


--
-- Name: availability availability_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.availability
    ADD CONSTRAINT availability_pkey PRIMARY KEY (availability_id);


--
-- Name: class class_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class
    ADD CONSTRAINT class_pkey PRIMARY KEY (class_id);


--
-- Name: class class_schedule_id_day_id_employee_id_time_range_excl; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class
    ADD CONSTRAINT class_schedule_id_day_id_employee_id_time_range_excl EXCLUDE USING gist (schedule_id WITH =, day_id WITH =, employee_id WITH =, time_range WITH &&);


--
-- Name: class class_schedule_id_day_id_room_id_time_range_excl; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class
    ADD CONSTRAINT class_schedule_id_day_id_room_id_time_range_excl EXCLUDE USING gist (schedule_id WITH =, day_id WITH =, room_id WITH =, time_range WITH &&);


--
-- Name: course course_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course
    ADD CONSTRAINT course_pkey PRIMARY KEY (course_code);


--
-- Name: course_type course_type_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_type
    ADD CONSTRAINT course_type_pkey PRIMARY KEY (course_type_id);


--
-- Name: curriculum curriculum_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.curriculum
    ADD CONSTRAINT curriculum_pkey PRIMARY KEY (curriculum_id);


--
-- Name: curriculum curriculum_program_id_year_level_course_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.curriculum
    ADD CONSTRAINT curriculum_program_id_year_level_course_code_key UNIQUE (program_id, year_level, course_code);


--
-- Name: day day_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.day
    ADD CONSTRAINT day_name_key UNIQUE (name);


--
-- Name: day day_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.day
    ADD CONSTRAINT day_pkey PRIMARY KEY (day_id);


--
-- Name: employee employee_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_pkey PRIMARY KEY (employee_id);


--
-- Name: employee employee_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_username_key UNIQUE (username);


--
-- Name: login login_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login
    ADD CONSTRAINT login_pkey PRIMARY KEY (id);


--
-- Name: program program_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program
    ADD CONSTRAINT program_pkey PRIMARY KEY (program_id);


--
-- Name: room room_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.room
    ADD CONSTRAINT room_pkey PRIMARY KEY (room_id);


--
-- Name: room room_room_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.room
    ADD CONSTRAINT room_room_number_key UNIQUE (room_number);


--
-- Name: schedule schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedule
    ADD CONSTRAINT schedule_pkey PRIMARY KEY (schedule_id);


--
-- Name: section section_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.section
    ADD CONSTRAINT section_pkey PRIMARY KEY (section_id);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (username);


--
-- Name: idx_availability_employee_day; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_availability_employee_day ON public.availability USING btree (employee_id, day_id);


--
-- Name: idx_class_employee_day; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_class_employee_day ON public.class USING btree (employee_id, day_id);


--
-- Name: idx_class_room_day; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_class_room_day ON public.class USING btree (room_id, day_id);


--
-- Name: idx_class_schedule; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_class_schedule ON public.class USING btree (schedule_id);


--
-- Name: idx_class_section_day; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_class_section_day ON public.class USING btree (section_id, day_id);


--
-- Name: uq_active_schedule_per_term; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_active_schedule_per_term ON public.schedule USING btree (academic_year, school_term) WHERE ((status)::text = 'active'::text);


--
-- Name: availability availability_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.availability
    ADD CONSTRAINT availability_day_id_fkey FOREIGN KEY (day_id) REFERENCES public.day(day_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: availability availability_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.availability
    ADD CONSTRAINT availability_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employee(employee_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: class class_course_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class
    ADD CONSTRAINT class_course_code_fkey FOREIGN KEY (course_code) REFERENCES public.course(course_code) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: class class_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class
    ADD CONSTRAINT class_day_id_fkey FOREIGN KEY (day_id) REFERENCES public.day(day_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: class class_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class
    ADD CONSTRAINT class_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employee(employee_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: class class_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class
    ADD CONSTRAINT class_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.room(room_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: class class_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class
    ADD CONSTRAINT class_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.schedule(schedule_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: class class_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class
    ADD CONSTRAINT class_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.section(section_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: course course_course_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course
    ADD CONSTRAINT course_course_type_id_fkey FOREIGN KEY (course_type_id) REFERENCES public.course_type(course_type_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: curriculum curriculum_course_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.curriculum
    ADD CONSTRAINT curriculum_course_code_fkey FOREIGN KEY (course_code) REFERENCES public.course(course_code) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: curriculum curriculum_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.curriculum
    ADD CONSTRAINT curriculum_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.program(program_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: employee employee_username_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_username_fkey FOREIGN KEY (username) REFERENCES public."user"(username) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: section section_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.section
    ADD CONSTRAINT section_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.program(program_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict JOqNrzDO6BFTP4TeUKzOiCo3Xgng1WJMIGLekTrBmcYeInmiJ4g56yfDta22D3B

