declare module "@joplin/turndown-plugin-gfm" {
    interface TurndownGfm {
        gfm: () => any;
        tables: () => any;
        strikethrough: () => any;
        taskListItems: () => any;
    }
    const gfm: TurndownGfm;
    export = gfm;
}