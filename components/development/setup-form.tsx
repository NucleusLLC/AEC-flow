"use client";

import { useState } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { SaveControl } from "@/components/development/save-control";
import {
  DEV_PROJECT_STATUS_LABEL,
  DEV_PROJECT_TYPE_LABEL,
  PROPERTY_TYPE_LABEL,
  type DevelopmentProject,
  type DevProjectStatus,
  type DevProjectType,
  type PropertyType,
} from "@/lib/data/development.types";
import { useT } from "@/components/i18n/language-provider";

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const labelCls = "mb-1 block text-xs font-medium text-muted";

export function SetupForm({ project }: { project: DevelopmentProject }) {
  const t = useT();
  const [p, setP] = useState(project);
  const set = <K extends keyof DevelopmentProject>(k: K, v: DevelopmentProject[K]) => setP((prev) => ({ ...prev, [k]: v }));

  const text = (k: keyof DevelopmentProject, label: string, placeholder?: string) => (
    <div>
      <label className={labelCls}>{label}</label>
      <input className={inputCls} value={(p[k] as string) ?? ""} placeholder={placeholder} onChange={(e) => set(k, e.target.value as never)} />
    </div>
  );
  const date = (k: keyof DevelopmentProject, label: string) => (
    <div>
      <label className={labelCls}>{label}</label>
      <input type="date" className={inputCls} value={(p[k] as string) ?? ""} onChange={(e) => set(k, (e.target.value || null) as never)} />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <SaveControl method="PATCH" url={`/api/development/${project.id}`} build={() => p} label={t("Save setup")} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("Project")} subtitle={t("Identity, parties and classification")} />
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">{text("name", t("Name"))}</div>
            {text("location", t("Location"))}
            {text("clientOwner", t("Client / owner"))}
            {text("developer", t("Developer"))}
            <div>
              <label className={labelCls}>{t("Status")}</label>
              <select className={inputCls} value={p.status} onChange={(e) => set("status", e.target.value as DevProjectStatus)}>
                {(Object.keys(DEV_PROJECT_STATUS_LABEL) as DevProjectStatus[]).map((s) => <option key={s} value={s}>{t(DEV_PROJECT_STATUS_LABEL[s])}</option>)}
              </select>
            </div>
            {text("currency", t("Currency"))}
            <div>
              <label className={labelCls}>{t("Total parcel area (m²)")}</label>
              <input type="number" className={inputCls} value={p.totalParcelArea} onChange={(e) => set("totalParcelArea", Number(e.target.value))} />
            </div>
            {text("zoningClassification", t("Zoning"))}
            {text("ropvArticleRef", t("ROPV article"))}
            <div>
              <label className={labelCls}>{t("Property type")}</label>
              <select className={inputCls} value={p.propertyType} onChange={(e) => set("propertyType", e.target.value as PropertyType)}>
                {(Object.keys(PROPERTY_TYPE_LABEL) as PropertyType[]).map((s) => <option key={s} value={s}>{t(PROPERTY_TYPE_LABEL[s])}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t("Project type")}</label>
              <select className={inputCls} value={p.projectType} onChange={(e) => set("projectType", e.target.value as DevProjectType)}>
                {(Object.keys(DEV_PROJECT_TYPE_LABEL) as DevProjectType[]).map((s) => <option key={s} value={s}>{t(DEV_PROJECT_TYPE_LABEL[s])}</option>)}
              </select>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("Programme")} subtitle={t("Key target dates from acquisition to close-out")} />
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {date("startDate", t("Start date"))}
            {date("targetPermitDate", t("Target permit"))}
            {date("targetInfraDate", t("Target infrastructure"))}
            {date("targetSalesLaunchDate", t("Target sales launch"))}
            {date("targetCloseoutDate", t("Target close-out"))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
