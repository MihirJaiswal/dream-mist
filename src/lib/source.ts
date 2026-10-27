import { docs } from "collections/server";
import { loader } from "fumadocs-core/source";

/** Docs pages (content/docs) */
export const source = loader({ baseUrl: "/docs", source: docs.toFumadocsSource() });
