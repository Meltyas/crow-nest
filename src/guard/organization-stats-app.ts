import { MODULE_ID } from "@/constants";
import { GuardStat, LogEntry, getLog, getStats, saveStats } from "./stats";

declare const Sortable: any;

export default class OrganizationStatsApp extends Application {
  stats: GuardStat[] = [];
  log: LogEntry[] = [];

  static override get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "crow-guard-stats",
      template: `modules/${MODULE_ID}/templates/guard/stats.html`,
      title: "Guard Stats",
      width: 400,
      height: "auto",
      resizable: true,
    });
  }

  constructor(options: Partial<ApplicationOptions> = {}) {
    super(options);
  }

  override async getData() {
    this.stats = duplicate(getStats());
    this.log = duplicate(getLog());
    return {
      stats: this.stats,
      log: this.log,
      isGM: game.user?.isGM,
    };
  }

  override activateListeners(html: JQuery) {
    super.activateListeners(html);
    html.find(".roll-stat").on("click", (ev) => this._onRoll(ev));
    if (!game.user?.isGM) return;
    html.find(".add-stat").on("click", () => this._onAdd());
    html.find(".edit-stat").on("click", (ev) => this._onEdit(ev));
    html.find(".delete-stat").on("click", (ev) => this._onDelete(ev));
    const list = html.find(".stat-list")[0];
    if (list && Sortable) {
      Sortable.create(list, {
        handle: ".drag-handle",
        animation: 150,
        onEnd: () => this._onReorder(list),
      });
    }
  }

  private async _onRoll(ev: JQuery.ClickEvent) {
    const key = $(ev.currentTarget).data("key");
    const stat = this.stats.find((s) => s.key === key);
    if (!stat) return;
    const r = new Roll(`1d20 + ${stat.value}`);
    r.evaluate({ async: false });
    r.toMessage({ speaker: { alias: "Guardia" }, flavor: stat.name });
  }

  private async _promptForStat(
    stat?: GuardStat
  ): Promise<{ name: string; value: number } | null> {
    return new Promise((resolve) => {
      const content = `<form>
        <div class="form-group"><label>Nombre</label><input type="text" name="name" value="${stat?.name ?? ""}"/></div>
        <div class="form-group"><label>Valor</label><input type="number" step="1" name="value" value="${stat?.value ?? 0}"/></div>
      </form>`;
      new Dialog({
        title: stat ? "Editar Stat" : "Nuevo Stat",
        content,
        buttons: {
          ok: {
            label: "OK",
            callback: (html: JQuery) => {
              const name = String(html.find("[name=name]").val());
              const value = parseInt(
                String(html.find("[name=value]").val()),
                10
              );
              if (Number.isNaN(value)) {
                ui.notifications.error("Valor inválido");
                resolve(null);
              } else {
                resolve({ name, value });
              }
            },
          },
          cancel: { label: "Cancelar", callback: () => resolve(null) },
        },
        default: "ok",
        close: () => resolve(null),
      }).render(true);
    });
  }

  private _nextKey(): string {
    let i = 1;
    while (this.stats.find((s) => s.key === `stat_${i}`)) i++;
    return `stat_${i}`;
  }

  private async _onAdd() {
    const data = await this._promptForStat();
    if (!data) return;
    const stat: GuardStat = {
      key: this._nextKey(),
      name: data.name,
      value: data.value,
    };
    this.stats.push(stat);
    this.log.push({
      user: game.user!.name!,
      time: Date.now(),
      action: `create ${stat.key}`,
      next: stat,
    });
    await saveStats(this.stats, this.log);
    this.render();
  }

  private async _onEdit(ev: JQuery.ClickEvent) {
    const key = $(ev.currentTarget).data("key");
    const stat = this.stats.find((s) => s.key === key);
    if (!stat) return;
    const previous = { ...stat };
    const data = await this._promptForStat(stat);
    if (!data) return;
    stat.name = data.name;
    stat.value = data.value;
    this.log.push({
      user: game.user!.name!,
      time: Date.now(),
      action: `edit ${stat.key}`,
      previous,
      next: { ...stat },
    });
    await saveStats(this.stats, this.log);
    this.render();
  }

  private async _onDelete(ev: JQuery.ClickEvent) {
    const key = $(ev.currentTarget).data("key");
    const index = this.stats.findIndex((s) => s.key === key);
    if (index === -1) return;
    const confirmed = await Dialog.confirm({
      title: "Borrar Stat",
      content: `¿Eliminar ${this.stats[index].name}?`,
    });
    if (!confirmed) return;
    const [removed] = this.stats.splice(index, 1);
    this.log.push({
      user: game.user!.name!,
      time: Date.now(),
      action: `delete ${removed.key}`,
      previous: removed,
    });
    await saveStats(this.stats, this.log);
    this.render();
  }

  private async _onReorder(list: HTMLElement) {
    const newOrder: GuardStat[] = [];
    $(list)
      .children(".stat")
      .each((i, el) => {
        const key = $(el).data("key");
        const stat = this.stats.find((s) => s.key === key);
        if (stat) newOrder.push(stat);
      });
    this.stats = newOrder;
    this.log.push({
      user: game.user!.name!,
      time: Date.now(),
      action: "reorder",
    });
    await saveStats(this.stats, this.log);
    this.render(false);
  }
}
