"use client";

import { useRef } from "react";
import { Link2, Mail, MessageCircle, MessageSquareText, QrCode, Send } from "lucide-react";
import { NativeSelectOption } from "@/components/ui/native-select";
import type { InviteSettings } from "@/lib/invite";
import { useStudio } from "./context";
import { Card, CardBody, CardHeader, ChoiceCard, Field, PlainSelect, Segmented, TextInput } from "./ui";

export function MessagePanel() {
  const { settings, updateSettings } = useStudio();
  const textarea = useRef<HTMLTextAreaElement>(null);

  function insertName() {
    const element = textarea.current;
    if (!element) return updateSettings({ messageTemplate: `${settings.messageTemplate}{name}` });
    const { selectionStart, selectionEnd, value } = element;
    const next = `${value.slice(0, selectionStart)}{name}${value.slice(selectionEnd)}`;
    updateSettings({ messageTemplate: next });
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(selectionStart + 6, selectionStart + 6);
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader icon={<Send size={18} />} title="How invites are sent" description="Tapping Send opens the app with the message ready and downloads the guest’s flyer to attach." />
        <CardBody className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2">
            <ChoiceCard
              selected={settings.deliveryMode === "whatsapp"}
              onSelect={() => updateSettings({ deliveryMode: "whatsapp" })}
              icon={<MessageCircle size={17} />}
              title="WhatsApp"
              description="Opens a chat with the guest."
            />
            <ChoiceCard
              selected={settings.deliveryMode === "both"}
              onSelect={() => updateSettings({ deliveryMode: "both" })}
              icon={<Mail size={17} />}
              title="WhatsApp + email"
              description="Also opens an email draft for guests with an address."
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">How guests check in</p>
            <Segmented<InviteSettings["checkInMode"]>
              label="Check-in method"
              value={settings.checkInMode}
              onChange={(value) => updateSettings({ checkInMode: value })}
              options={[
                { value: "qr", label: "QR code on flyer", icon: <QrCode size={15} /> },
                { value: "link", label: "Ticket link", icon: <Link2 size={15} /> },
              ]}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          icon={<MessageSquareText size={18} />}
          title="Message"
          description="Each guest’s personal RSVP links are added underneath automatically."
          action={
            <button onClick={insertName} className="flex h-9 items-center rounded-xl bg-brand-soft px-3 font-mono text-xs font-bold text-brand-ink hover:brightness-95">
              + {"{name}"}
            </button>
          }
        />
        <CardBody>
          <textarea
            ref={textarea}
            id="message-template"
            aria-label="Invitation message"
            value={settings.messageTemplate}
            onChange={(event) => updateSettings({ messageTemplate: event.target.value })}
            rows={7}
            className="w-full resize-y rounded-2xl border border-line bg-surface-2 p-4 text-[15px] leading-7 outline-none transition focus:border-brand focus:bg-surface focus:ring-4 focus:ring-brand/15"
          />
          <p className="mt-2 text-xs text-ink-3">
            <span className="font-mono font-semibold text-ink-2">{"{name}"}</span> becomes each guest’s full name.
          </p>
        </CardBody>
      </Card>

      {settings.deliveryMode === "both" && (
        <Card>
          <CardHeader icon={<Mail size={18} />} title="Email" description="You must already be signed in to the email account you choose." />
          <CardBody className="grid gap-4 md:grid-cols-2">
            <Field label="Open emails in">
              <PlainSelect label="Email provider" value={settings.emailProvider} onChange={(value) => updateSettings({ emailProvider: value as InviteSettings["emailProvider"] })}>
                <NativeSelectOption value="gmail">Gmail</NativeSelectOption>
                <NativeSelectOption value="outlook">Outlook</NativeSelectOption>
                <NativeSelectOption value="default">Default mail app</NativeSelectOption>
              </PlainSelect>
            </Field>
            <Field label="Send from (optional)">
              <TextInput type="email" value={settings.senderEmail} onChange={(event) => updateSettings({ senderEmail: event.target.value })} placeholder="you@company.com" />
            </Field>
            <Field label="Subject" className="md:col-span-2">
              <TextInput value={settings.emailSubject} onChange={(event) => updateSettings({ emailSubject: event.target.value })} />
            </Field>
          </CardBody>
        </Card>
      )}

      <div className="rounded-3xl border border-dashed border-[#d9d4ca] p-5 text-sm leading-6 text-ink-2">
        <p className="font-semibold text-ink">Sending, step by step</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Tap <span className="font-semibold text-ink">Send</span> next to a guest.</li>
          <li>WhatsApp opens with their message, and their flyer downloads.</li>
          <li>Attach the flyer, tap Send in WhatsApp, then come back for the next guest.</li>
        </ol>
      </div>
    </div>
  );
}
