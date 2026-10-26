/* eslint-disable @next/next/no-img-element -- images servies par la route du site ou par URL signée : pas d'optimisation next/image. */
import { Clock, MapPin, MessageCircle } from "lucide-react";

import type { SiteModel } from "@/features/websites/model";
import type { SiteSection } from "@/features/websites/templates";
import { whatsappLink } from "@/lib/whatsapp";

function ContactButton({ site }: { site: SiteModel }) {
  if (!site.business.whatsapp) return null;
  return (
    <a
      href={whatsappLink(site.business.whatsapp, site.template.contactText)}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="site-whatsapp"
      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--site-accent)] px-5 text-base font-semibold text-white shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--site-accent)] focus-visible:ring-offset-2 focus-visible:outline-none sm:w-auto"
    >
      <MessageCircle aria-hidden="true" className="size-5" />
      Écrire sur WhatsApp
    </a>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function renderSection(site: SiteModel, section: SiteSection) {
  switch (section) {
    case "services":
      return site.services.length ? (
        <Section
          key={section}
          id="site-services"
          title={site.template.servicesTitle}
        >
          <ul className="flex flex-col gap-3">
            {site.services.map((service, index) => (
              <li
                key={index}
                className="flex gap-3 rounded-xl border bg-card p-3"
              >
                {service.imageUrl ? (
                  <img
                    src={service.imageUrl}
                    alt=""
                    loading="lazy"
                    className="size-20 shrink-0 rounded-lg object-cover"
                  />
                ) : null}
                <div className="flex min-w-0 flex-col gap-1">
                  {service.category ? (
                    <p className="text-xs text-muted-foreground uppercase">
                      {service.category}
                    </p>
                  ) : null}
                  <p className="font-medium break-words">{service.name}</p>
                  {service.description ? (
                    <p className="text-sm break-words text-muted-foreground">
                      {service.description}
                    </p>
                  ) : null}
                  <p className="text-sm font-semibold">{service.priceLabel}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null;
    case "gallery":
      return site.gallery.length ? (
        <Section
          key={section}
          id="site-gallery"
          title={site.template.galleryTitle}
        >
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {site.gallery.map((url, index) => (
              <li key={index}>
                <img
                  src={url}
                  alt={`Photo ${index + 1} de ${site.business.name}`}
                  loading="lazy"
                  className="aspect-square w-full rounded-lg object-cover"
                />
              </li>
            ))}
          </ul>
        </Section>
      ) : null;
    case "about":
      return site.content.about ? (
        <Section key={section} id="site-about" title="À propos">
          <p className="break-words whitespace-pre-line">
            {site.content.about}
          </p>
        </Section>
      ) : null;
    case "hours":
      return site.content.hours ? (
        <Section key={section} id="site-hours" title="Horaires">
          <p className="flex gap-2 whitespace-pre-line">
            <Clock
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-[var(--site-accent)]"
            />
            <span className="break-words">{site.content.hours}</span>
          </p>
        </Section>
      ) : null;
  }
}

/**
 * Rendu d'un site (publié ou aperçu) : mêmes composants dans les deux cas,
 * pour que l'aperçu montre exactement ce qui sera publié.
 */
export function SiteView({ site }: { site: SiteModel }) {
  const place = site.content.area ?? site.business.city;
  return (
    <div
      className="flex flex-col"
      style={{ "--site-accent": site.accentColor } as React.CSSProperties}
    >
      <header className="flex flex-col">
        {site.bannerUrl ? (
          <img
            src={site.bannerUrl}
            alt=""
            className="aspect-[16/7] w-full object-cover"
          />
        ) : (
          <div aria-hidden="true" className="h-20 bg-[var(--site-accent)]" />
        )}
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 pt-4">
          {site.logoUrl ? (
            <img
              src={site.logoUrl}
              alt={`Logo de ${site.business.name}`}
              className="-mt-12 size-20 rounded-full border-4 border-background bg-background object-cover"
            />
          ) : null}
          <h1 className="text-3xl leading-tight font-bold break-words">
            {site.business.name}
          </h1>
          {site.content.headline ? (
            <p className="text-lg break-words text-muted-foreground">
              {site.content.headline}
            </p>
          ) : null}
          {place ? (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin aria-hidden="true" className="size-4 shrink-0" />
              {place}
            </p>
          ) : null}
          <ContactButton site={site} />
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
        {site.template.sections.map((section) => renderSection(site, section))}
        {site.business.whatsapp ? (
          <section
            aria-labelledby="site-contact"
            className="flex flex-col gap-3 rounded-xl border bg-card p-4"
          >
            <h2 id="site-contact" className="text-xl font-semibold">
              Contact
            </h2>
            <p className="text-sm text-muted-foreground">
              Réponse directement sur WhatsApp, avec le numéro de{" "}
              {site.business.name}.
            </p>
            <ContactButton site={site} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
