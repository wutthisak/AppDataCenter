"use client";

import { useId } from "react";

const options = [
  { value: "vm", label: "VM Host" },
  { value: "host", label: "Host" }
];

export function ServerTypeFilter({ selectedType }: { selectedType: "vm" | "host" }) {
  const id = useId();

  return (
    <section className="filter-bar">
      <form action="/servers" method="get">
        <label htmlFor={id}>
          ประเภท
          <select
            id={id}
            name="type"
            defaultValue={selectedType}
            onChange={(event) => event.currentTarget.form?.submit()}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </form>
    </section>
  );
}
