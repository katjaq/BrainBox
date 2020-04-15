'use strict';

const fs = require('fs');
const chai = require('chai');
const assert = chai.assert;
const chaiHttp = require('chai-http');
chai.use(chaiHttp);
const U = require('../utils.js');

describe('TESTING AN MRI UPLOAD/DOWNLOAD WORKFLOW', async function () {
    describe('Fail soon', async function () {
        it('Returns 404', async () => {
            const res = await chai.request(U.serverURL).post('/upload').query();
            assert.equal(res.statusCode, 404);
        });
    });

    describe('Create a test token', async function () {
        it('Can create a test token', async () => {
            await U.insertTestTokenForUser("foo");
        });
    });

    describe('Simple upload workflow', async function () {
        it('Does not find a non-existent user', async () => {
            const res = await U.queryUser("foo");
            assert.isNull(res);
        });
        it('Can insert a test user in the DB', async () => {
            await U.insertUser(U.userFoo);
        });
        // it('Can upload an MRI', async () => {
        //     const res = await chai.request(url).post('/upload').query();
        // });
        it('Finds the inserted user', async () => {
            const res = await U.queryUser("foo");
            const expectedKeys = ["_id", "name", "nickname", "url", "brainboxURL", "avatarURL", "joined"];
            assert.hasAllKeys(res, expectedKeys);
            assert.equal(res.name, U.userFoo.name);
            assert.equal(res.nickname, U.userFoo.nickname);
            assert.equal(res.url, U.userFoo.url);
        });
        it('Removes test user from the DB', async () => {
            await U.removeUser(U.userFoo.nickname);
        });
        it('Does not find the removed user', async () => {
            const res = await U.queryUser("foo");
            assert.isNull(res);
        });
    });

    describe('Remove a test token', async function () {
        it('Can remove a test token', async () => {
            await U.removeTestToken();
        });
    });
});