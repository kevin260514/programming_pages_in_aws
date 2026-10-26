package com.pag.app.assistant;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.Test;

class RateLimiterTest {

    @Test
    void permiteHastaElMaximoYBloqueaElSiguiente() {
        AtomicLong time = new AtomicLong(1_000);
        RateLimiter limiter = new RateLimiter(2, 60_000, time::get);

        assertTrue(limiter.tryAcquire("1.1.1.1"));
        assertTrue(limiter.tryAcquire("1.1.1.1"));
        assertFalse(limiter.tryAcquire("1.1.1.1"));
    }

    @Test
    void cadaClienteTieneSuPropioContador() {
        AtomicLong time = new AtomicLong(0);
        RateLimiter limiter = new RateLimiter(1, 60_000, time::get);

        assertTrue(limiter.tryAcquire("a"));
        assertFalse(limiter.tryAcquire("a"));
        assertTrue(limiter.tryAcquire("b"));
    }

    @Test
    void laVentanaSeReiniciaConElTiempo() {
        AtomicLong time = new AtomicLong(0);
        RateLimiter limiter = new RateLimiter(1, 60_000, time::get);

        assertTrue(limiter.tryAcquire("a"));
        assertFalse(limiter.tryAcquire("a"));

        time.addAndGet(59_999);
        assertFalse(limiter.tryAcquire("a"));

        time.addAndGet(1);
        assertTrue(limiter.tryAcquire("a"));
    }
}
