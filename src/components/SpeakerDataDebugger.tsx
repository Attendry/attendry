/**
 * SpeakerDataDebugger Component
 * 
 * A debugging component to help understand what speaker data is being passed
 * to the speaker cards and identify any issues with title/organization display.
 */

"use client";
import React from "react";
import { SpeakerData } from "@/lib/types/core";

interface SpeakerDataDebuggerProps {
  speaker: SpeakerData;
  label?: string;
}

export default function SpeakerDataDebugger({ speaker, label = "Speaker Data" }: SpeakerDataDebuggerProps) {
  if (process.env.NODE_ENV !== 'development') {
    return null; // Only show in development
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 text-xs">
      <h4 className="font-semibold text-yellow-800 mb-2">{label}</h4>
      <div className="space-y-1 text-yellow-700">
        <div><strong>Name:</strong> {speaker.name || 'MISSING'}</div>
        <div><strong>Title:</strong> {speaker.title || 'MISSING'}</div>
        <div><strong>Org:</strong> {speaker.org || 'MISSING'}</div>
        <div><strong>Profile URL:</strong> {speaker.profile_url || 'MISSING'}</div>
        <div><strong>Source URL:</strong> {speaker.source_url || 'MISSING'}</div>
        <div><strong>Session:</strong> {speaker.session || 'MISSING'}</div>
        <div><strong>Speech Title:</strong> {speaker.speech_title || 'MISSING'}</div>
        <div><strong>Bio:</strong> {speaker.bio || 'MISSING'}</div>
        <div><strong>Confidence:</strong> {speaker.confidence || 'MISSING'}</div>
        <div><strong>Raw Object:</strong> <pre className="mt-1 text-xs overflow-auto">{JSON.stringify(speaker, null, 2)}</pre></div>
      </div>
    </div>
  );
}
