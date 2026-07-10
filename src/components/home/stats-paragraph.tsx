import { getPageContent } from "@/server/services/content.service";

export async function StatsParagraph() {
  const content = await getPageContent("home.stats");

  return (
    <section className="bg-white py-8">
      <div className="container-page">
        <div className="mx-auto max-w-3xl text-center leading-loose text-navy">
          <p className="mb-4 text-xl font-bold sm:text-2xl">{content.heading}</p>
          <p className="mb-4 text-base sm:text-lg">
            {content.paragraph1.split("\n").map((line, index, arr) => (
              <span key={index}>
                {line}
                {index < arr.length - 1 && <br />}
              </span>
            ))}
          </p>
          <p className="text-base sm:text-lg">{content.paragraph2}</p>
        </div>
      </div>
    </section>
  );
}
