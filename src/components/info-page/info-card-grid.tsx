export interface InfoCard {
  title: string;
  content: React.ReactNode;
}

export function InfoCardGrid({ cards }: { cards: InfoCard[] }) {
  return (
    <div className="container-page mb-16 mt-8">
      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2">
        {cards.map((card) => (
          <div
            key={card.title}
            className="relative z-0 rounded-2xl bg-white p-8 shadow-[0_8px_16px_rgba(0,0,0,0.05)] transition-[transform,box-shadow] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:z-10 hover:shadow-[0_18px_38px_-22px_rgba(2,56,89,0.34),0_8px_18px_-16px_rgba(2,56,89,0.20)] focus-within:z-10 focus-within:shadow-[0_18px_38px_-22px_rgba(2,56,89,0.34),0_8px_18px_-16px_rgba(2,56,89,0.20)] motion-safe:hover:-translate-y-[5px] motion-safe:focus-within:-translate-y-[5px] motion-reduce:transition-none"
          >
            <h2 className="mb-3 text-lg font-normal text-accent sm:text-xl">{card.title}</h2>
            <hr className="mb-3 border-border" />
            <div className="text-[15px] leading-relaxed text-ink">{card.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Renders a card body as a bullet list if it contains multiple lines, else a plain paragraph. */
export function CardBody({ text }: { text: string }) {
  const lines = text.split("\n").filter(Boolean);
  if (lines.length > 1) {
    return (
      <ul className="list-disc space-y-1 pl-5">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    );
  }
  return <p>{text}</p>;
}
