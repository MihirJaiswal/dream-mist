import { source } from "@/lib/source";
import { createFromSource } from "fumadocs-core/search/server";

//Static search index, generated at build time
export const revalidate = false;
export const { staticGET: GET } = createFromSource(source);
