'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { benutzePipeline } from '@/hooks/benutze-leads';
import { benutzeLeadAktualisieren } from '@/hooks/benutze-leads';
import { KanbanSpalte } from './kanban-spalte';
import { LeadKarte } from './lead-karte';
import { LeadDetail } from './lead-detail';
import type { Lead } from '@/lib/typen';

interface KanbanBoardProps {
  kampagneId: string;
}

export function KanbanBoard({ kampagneId }: KanbanBoardProps) {
  const { data, isLoading } = benutzePipeline(kampagneId);
  const aktualisieren = benutzeLeadAktualisieren();
  const [aktiverLead, setAktiverLead] = useState<Lead | null>(null);
  const [ausgewaehlterLeadId, setAusgewaehlterLeadId] = useState<string | null>(null);

  const sensoren = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const leadFinden = useCallback((id: string): Lead | null => {
    if (!data?.pipeline) return null;
    for (const leads of Object.values(data.pipeline)) {
      const lead = leads.find((l: Lead) => l.id === id);
      if (lead) return lead;
    }
    return null;
  }, [data]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const lead = leadFinden(event.active.id as string);
    setAktiverLead(lead);
  }, [leadFinden]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setAktiverLead(null);

    if (!over) return;

    const leadId = active.id as string;
    const neuerStatus = over.id as string;
    const lead = leadFinden(leadId);

    if (lead && lead.status !== neuerStatus && data?.spalten.includes(neuerStatus)) {
      aktualisieren.mutate({ id: leadId, status: neuerStatus });
    }
  }, [leadFinden, aktualisieren, data]);

  if (isLoading) {
    return (
      <div className="flex gap-4 h-full overflow-x-auto pb-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex-shrink-0 w-72">
            <div className="skeleton h-8 w-full rounded-lg mb-3" />
            <div className="space-y-3">
              <div className="skeleton h-24 w-full rounded-xl" />
              <div className="skeleton h-24 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      <DndContext
        sensors={sensoren}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 h-full overflow-x-auto pb-4">
          {data.spalten.map((spalte) => (
            <KanbanSpalte
              key={spalte}
              spalte={spalte}
              leads={data.pipeline[spalte] || []}
              onLeadKlick={(lead) => setAusgewaehlterLeadId(lead.id)}
            />
          ))}
        </div>

        <DragOverlay>
          {aktiverLead && (
            <div className="rotate-2 opacity-90">
              <LeadKarte lead={aktiverLead} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {ausgewaehlterLeadId && (
        <LeadDetail
          leadId={ausgewaehlterLeadId}
          onSchliessen={() => setAusgewaehlterLeadId(null)}
        />
      )}
    </>
  );
}
