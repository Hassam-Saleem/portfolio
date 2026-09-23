import { ChatWidget } from "@/components/ChatWidget";
import { ArrowUpRightIcon, CheckIcon, GitHubIcon, LinkedInIcon, MailIcon, PlayIcon } from "@/components/icons";
import { education, experience, featuredProjects, liveApps, site, skills, stats } from "@/lib/site";

const Section = ({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="scroll-mt-20 py-12 sm:py-16">
    <p className="text-xs font-semibold uppercase tracking-widest text-brand">{eyebrow}</p>
    <h2 className="mb-8 mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
    {children}
  </section>
);

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-full border border-line bg-bg px-2.5 py-1 text-xs font-medium text-muted">{children}</span>
);

export default function Home() {
  const { linkedin, github, email } = site.links;
  const social = [
    linkedin && { label: "LinkedIn", href: linkedin, Icon: LinkedInIcon },
    github && { label: "GitHub", href: github, Icon: GitHubIcon },
    email && { label: "Email", href: `mailto:${email}`, Icon: MailIcon },
  ].filter(Boolean) as { label: string; href: string; Icon: typeof MailIcon }[];

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 text-sm sm:px-6">
          <a href="#top" className="flex items-center gap-2.5 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-linear-to-br from-brand to-brand-2 text-xs font-bold text-white">HS</span>
            {site.name}
          </a>
          <div className="flex items-center gap-1 text-muted sm:gap-5">
            <a href="#projects" className="hidden hover:text-ink sm:inline">Projects</a>
            <a href="#apps" className="hidden hover:text-ink sm:inline">Apps</a>
            <a href="#experience" className="hidden hover:text-ink sm:inline">Experience</a>
            <a href="#contact" className="rounded-full border border-line px-3 py-1.5 font-medium text-ink hover:border-brand">Contact</a>
          </div>
        </nav>
      </header>

      <div className="relative overflow-hidden border-b border-line bg-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_60%_at_85%_0%,#e0e7ff_0%,transparent_70%),radial-gradient(40%_50%_at_0%_10%,#f3e8ff_0%,transparent_70%)]"
        />
        <div id="top" className="relative mx-auto grid max-w-5xl gap-10 px-4 py-14 sm:px-6 sm:py-20 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              {site.title} · Flutter · MERN · AI
            </p>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-6xl">
              Hi, I&apos;m <span className="bg-linear-to-r from-brand to-brand-2 bg-clip-text text-transparent">{site.firstName}</span>.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">{site.tagline}</p>
            <p className="mt-3 max-w-xl text-muted">{site.summary}</p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#projects"
                className="inline-flex items-center gap-1.5 rounded-full bg-linear-to-r from-brand to-brand-2 px-5 py-3 text-sm font-semibold text-brand-ink shadow-lg shadow-brand/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand/30"
              >
                View projects
              </a>
              <div className="flex items-center gap-2">
                {social.map(({ label, href, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    aria-label={label}
                    title={label}
                    target={href.startsWith("http") ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="grid h-11 w-11 place-items-center rounded-full border border-line bg-white text-muted transition hover:border-brand hover:text-brand"
                  >
                    <Icon />
                  </a>
                ))}
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-3 md:grid-cols-1 md:gap-4">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col rounded-2xl border border-line bg-white/80 p-4 shadow-sm backdrop-blur md:min-w-52 md:p-5">
                <dt className="order-2 mt-1 text-xs leading-snug text-muted">{s.label}</dt>
                <dd className="text-2xl font-extrabold tracking-tight text-brand sm:text-3xl">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* pb-28 keeps the last content clear of the pinned chat button on small screens */}
      <main className="mx-auto max-w-5xl px-4 pb-28 sm:px-6 sm:pb-32">
        <Section id="projects" eyebrow="Featured work" title="Projects">
          <div className="grid gap-6 md:grid-cols-2">
            {featuredProjects.map((p) => (
              <article key={p.name} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                <div className="h-1.5 bg-linear-to-r from-brand to-brand-2" />
                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <h3 className="text-xl font-bold">{p.name}</h3>
                  <p className="mt-1 text-sm font-medium text-brand">{p.kind}</p>
                  <p className="mt-3 text-sm text-muted">{p.blurb}</p>
                  <ul className="mt-4 space-y-2.5 text-sm">
                    {p.highlights.map((h) => (
                      <li key={h} className="flex gap-2.5">
                        <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto flex flex-wrap gap-2 pt-5">
                    {p.stack.map((s) => (
                      <Chip key={s}>{s}</Chip>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Section>

        <Section id="apps" eyebrow="Published" title="Live on Google Play">
          <div className="grid gap-4 sm:grid-cols-2">
            {liveApps.map((a) => (
              <a
                key={a.url}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                    <PlayIcon />
                  </span>
                  <span className="rounded-full bg-good-soft px-2.5 py-1 text-xs font-semibold text-good-ink">{a.downloads} downloads</span>
                </div>
                <h3 className="mt-4 font-semibold">{a.name}</h3>
                <p className="mt-1.5 flex-1 text-sm text-muted">{a.blurb}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand">
                  View on Google Play
                  <ArrowUpRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </a>
            ))}
          </div>
        </Section>

        <Section id="experience" eyebrow="Career" title="Experience">
          <ol className="relative space-y-6 border-l-2 border-line pl-6 sm:pl-8">
            {experience.map((e) => (
              <li key={e.org} className="relative">
                <span className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-brand bg-white sm:-left-[39px]" />
                <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="font-semibold">
                      {e.role} <span className="text-brand">· {e.org}</span>
                    </h3>
                    <span className="rounded-full bg-bg px-2.5 py-1 text-xs font-medium text-muted">{e.period}</span>
                  </div>
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted marker:text-brand/50">
                    {e.points.map((pt) => (
                      <li key={pt}>{pt}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="skills" eyebrow="Toolbox" title="Skills & education">
          <div className="grid gap-4 sm:grid-cols-2">
            {skills.map((g) => (
              <div key={g.group} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold">{g.group}</h3>
                <div className="flex flex-wrap gap-2">
                  {g.items.map((i) => (
                    <Chip key={i}>{i}</Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <p className="font-semibold">
              {education.degree} <span className="text-brand">· {education.school}</span>
            </p>
            <p className="mt-1 text-sm text-muted">
              {education.period} · {education.note}
            </p>
          </div>
        </Section>

        <section id="contact" className="scroll-mt-20 py-12 sm:py-16">
          <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand to-brand-2 p-7 text-white shadow-xl shadow-brand/20 sm:p-10">
            <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
            <h2 className="relative text-2xl font-bold tracking-tight sm:text-3xl">Get in touch</h2>
            <p className="relative mt-2 max-w-xl text-white/85">
              Got a question about {site.firstName}&apos;s work? Ask the assistant in the corner, or reach out directly.
            </p>
            <ul className="relative mt-6 flex flex-wrap gap-3">
              {social.map(({ label, href, Icon }) => (
                <li key={href}>
                  <a
                    href={href}
                    target={href.startsWith("http") ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-brand-soft"
                  >
                    <Icon className="h-[18px] w-[18px] text-brand" />
                    {label === "Email" ? email : label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-6 text-center text-xs text-muted">Built with Next.js, Supabase pgvector and NVIDIA NIM. The assistant answers only from Hassam&apos;s own documents.</p>
        </section>
      </main>

      <ChatWidget />
    </>
  );
}
