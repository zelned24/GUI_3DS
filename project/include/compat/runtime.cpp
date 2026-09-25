#include "cstddef"

static char s_heap[65536];
static size_t s_heap_pos = 0;

void operator delete(void* ptr) noexcept {
    (void)ptr;
}

void operator delete(void* ptr, unsigned long sz) noexcept {
    (void)ptr;
    (void)sz;
}

void* operator new(unsigned long sz) {
    if (s_heap_pos + sz > sizeof(s_heap)) return (void*)s_heap;
    void* p = (void*)&s_heap[s_heap_pos];
    s_heap_pos = (s_heap_pos + sz + 7) & ~7;
    return p;
}
