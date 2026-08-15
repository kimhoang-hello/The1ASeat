"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, X } from "@phosphor-icons/react";
import { t } from "@/lib/t";

const tBanner = t("banner");

export interface FeaturedOffer {
  slug: string;
  name: string;
  teaser: string;
  cardImage: string;
}

/** Long enough that the strip is read rather than watched. */
const ROTATE_MS = 30000;

/**
 * Cycles the strip through the elevated offers. The order arrives already
 * shuffled from the server — doing it here instead would mean the first card
 * rendered on the server and the first card after hydration disagreed.
 */
export function FeaturedOfferRotator({ offers }: { offers: FeaturedOffer[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (paused || dismissed || offers.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % offers.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [paused, dismissed, offers.length]);

  if (dismissed) return null;

  const offer = offers[index];
  const href = `/credit-cards/${offer.slug}`;

  return (
    // Paused on hover and on focus: without it a card can swap out from under
    // a cursor that was already on its way to the button.
    <div
      className="bg-primary text-primary-foreground"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* One line from sm up, where there is room to truncate and still say
          something. Below that the offer stacks onto two short lines and the
          strip grows instead — a cut-off card name is worth nothing. */}
      <div className="flex min-h-12 items-center gap-3 px-4 py-2 sm:h-12 sm:px-6 sm:py-0 lg:px-10 2xl:px-16">
        <span className="hidden shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider md:inline-block">
          {tBanner("eyebrow")}
        </span>

        {/* Remounted on every rotation by the key, which replays the fade. */}
        <div key={offer.slug} className="animate-offer-in flex min-w-0 flex-1 items-center">
          <Link href={href} className="flex min-w-0 items-center gap-2.5 hover:opacity-90 sm:gap-3">
            {offer.cardImage && (
              <Image
                src={offer.cardImage}
                alt=""
                width={56}
                height={36}
                sizes="56px"
                className="h-8 w-14 shrink-0 rounded object-contain"
              />
            )}
            <span className="min-w-0 text-xs leading-snug sm:truncate sm:text-sm">
              <span className="block font-bold sm:inline">{offer.name}</span>
              <span className="hidden sm:inline"> • </span>
              {/* Its own line on a phone, part of the same sentence above that,
                  where truncate takes care of a row that runs out of room. */}
              <span className="block text-primary-foreground/75 sm:inline">{offer.teaser}</span>
            </span>
          </Link>
        </div>

        <Link
          href={href}
          className="hidden shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-primary-foreground px-4 py-1.5 text-xs font-bold text-primary transition-opacity hover:opacity-90 sm:inline-flex"
        >
          {tBanner("cta")}
          <ArrowRight size={12} weight="bold" />
        </Link>

        <button
          type="button"
          aria-label={tBanner("close")}
          onClick={() => setDismissed(true)}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-primary-foreground/70 transition-colors hover:bg-white/10 hover:text-primary-foreground"
        >
          <X size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}
