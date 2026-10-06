import { NextRequest, NextResponse } from "next/server";
import { analyze, sectorKey } from "@/lib/hse/analytics";
import { lastReceivedAt, listResponses } from "@/lib/hse/store";

export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/hse/dashboard?setor=&from=YYYY-MM-DD&to=YYYY-MM-DD
 * A lista de setores devolvida é sempre a do período (ignora o filtro de setor),
 * para o seletor não encolher depois de escolher um.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const setor = params.get("setor")?.trim() ?? "";

  if ((from && !DATE.test(from)) || (to && !DATE.test(to))) {
    return NextResponse.json({ error: "Datas devem estar no formato YYYY-MM-DD." }, { status: 400 });
  }

  try {
    const inPeriod = await listResponses({ from: from || undefined, to: to || undefined });

    const sectorNames = new Map<string, string>();
    for (const row of inPeriod) sectorNames.set(sectorKey(row.setor), row.setor);

    const wanted = setor ? sectorKey(setor) : "";
    const rows = wanted ? inPeriod.filter((row) => sectorKey(row.setor) === wanted) : inPeriod;

    return NextResponse.json({
      analysis: analyze(rows),
      sectors: [...sectorNames.values()].sort((a, b) => a.localeCompare(b, "pt-BR")),
      updatedAt: await lastReceivedAt(),
    });
  } catch (error) {
    console.error(`[hse-dashboard] falha ao montar a dashboard: ${error}`);
    return NextResponse.json({ error: "Não foi possível carregar os dados." }, { status: 500 });
  }
}
