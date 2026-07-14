import type { EmailProvider, TransactionalEmailData, TransactionalEmailTemplate } from "./types";
import { renderTransactionalEmail } from "./templates";

export class TransactionalEmailService {
  constructor(private readonly provider: EmailProvider) {}

  send(template: TransactionalEmailTemplate, data: TransactionalEmailData) {
    return this.provider.send(renderTransactionalEmail(template, data));
  }
}

export type { EmailProvider, TransactionalEmailData, TransactionalEmailTemplate } from "./types";
