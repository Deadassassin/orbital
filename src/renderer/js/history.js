class HistoryManager {
  constructor() {
    this.entries = [];
  }

  async load() {
    try {
      this.entries = await (window.browserAPI ? window.browserAPI.getHistory() : []) || [];
    } catch (e) {
      this.entries = [];
    }
  }

  async search(query) {
    if (!query) return this.entries;
    try {
      return await (window.browserAPI ? window.browserAPI.searchHistory(query) : []) || [];
    } catch (e) {
      var q = query.toLowerCase();
      return this.entries.filter(function(h) {
        return (h.title && h.title.toLowerCase().indexOf(q) !== -1) || (h.url && h.url.toLowerCase().indexOf(q) !== -1);
      });
    }
  }

  async clear() {
    if (window.browserAPI) await window.browserAPI.clearHistory();
    this.entries = [];
  }

  async deleteEntry(id) {
    if (window.browserAPI) await window.browserAPI.deleteHistoryEntry(id);
    this.entries = this.entries.filter(function(h) { return h.id !== id; });
  }

  getGroupedByDate() {
    var groups = {};
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var yesterday = today - 86400000;
    var lastWeek = today - 7 * 86400000;

    for (var i = 0; i < this.entries.length; i++) {
      var entry = this.entries[i];
      var date = entry.lastVisit || entry.firstVisit || 0;
      var label;
      if (date >= today) label = 'Today';
      else if (date >= yesterday) label = 'Yesterday';
      else if (date >= lastWeek) label = 'This Week';
      else {
        var d = new Date(date);
        label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      }
      if (!groups[label]) groups[label] = [];
      groups[label].push(entry);
    }
    return groups;
  }
}

window.__historyManager = new HistoryManager();