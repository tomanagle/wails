package runtime

import (
	"context"
	"github.com/wailsapp/wails/v2/internal/frontend/filecache"
)

func CacheGet(ctx context.Context, key string) *filecache.CacheEntry {
	result := filecache.Get(key)
	EventsEmit(ctx, "wails:cache:get", key)
	return result
}

func CacheSet(ctx context.Context, key string, value []byte) {
	filecache.Set(key, value)
	EventsEmit(ctx, "wails:cache:set", key)
}

func CacheDelete(ctx context.Context, key string) {
	filecache.Delete(key)
	EventsEmit(ctx, "wails:cache:delete", key)
}
