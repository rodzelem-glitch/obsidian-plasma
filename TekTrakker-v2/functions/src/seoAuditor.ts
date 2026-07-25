import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { Organization } from "./types";

export const seoAuditor = functions.pubsub
  .schedule("0 0 * * 0") // Run weekly at midnight on Sunday
  .onRun(async (context) => {
    const db = admin.firestore();
    functions.logger.info("Starting weekly SEO Auditor run...");

    try {
      const orgsSnap = await db.collection("organizations").get();
      const weeklyAudits: any[] = [];
      let totalAudited = 0;
      let totalPassed = 0;
      let totalFailed = 0;

      for (const doc of orgsSnap.docs) {
        const org = doc.data() as Organization;
        const orgId = doc.id;

        // Check if public profile is enabled or a hosted site/profile slug is configured
        const publicProfileEnabled = !!org.publicProfileEnabled;
        const hasHostedSite = !!org.profileSlug;

        if (publicProfileEnabled || hasHostedSite) {
          totalAudited++;
          const recommendations: string[] = [];

          // 1. Valid name check
          const hasName = typeof org.name === "string" && org.name.trim().length > 0;
          if (!hasName) {
            recommendations.push("Organization name is missing or invalid.");
          }

          // 2. publicDescription check
          const hasPublicDesc = typeof org.publicDescription === "string" && org.publicDescription.trim().length > 0;
          if (!hasPublicDesc) {
            recommendations.push("Add a public description to help search engines understand your business and improve search relevance.");
          }

          // 3. serviceableRegions check
          const hasRegions = Array.isArray(org.serviceableRegions) && 
                              org.serviceableRegions.length > 0 && 
                              org.serviceableRegions.some(r => typeof r === "string" && r.trim().length > 0);
          if (!hasRegions) {
            recommendations.push("Define serviceable regions so customers can discover your business in local search results.");
          }

          // 4. profileImageUrl check
          const hasProfileImage = typeof org.profileImageUrl === "string" && org.profileImageUrl.trim().length > 0;
          if (!hasProfileImage) {
            recommendations.push("Upload a profile image to make your public profile look professional and increase visitor engagement.");
          }

          // 5. logoUrl check
          const hasLogo = typeof org.logoUrl === "string" && org.logoUrl.trim().length > 0;
          if (!hasLogo) {
            recommendations.push("Configure your organization logo to establish clear brand identity on your public page.");
          }

          // 6. reviewLinks check
          const reviewLinks = org.reviewLinks || {};
          const hasReviewLinks = typeof reviewLinks === "object" && 
                                  Object.values(reviewLinks).some(val => typeof val === "string" && val.trim().length > 0);
          if (!hasReviewLinks) {
            recommendations.push("Add links to your Google, Yelp, or other review profiles to build consumer trust and boost local SEO authority.");
          }

          const checklist = {
            name: hasName,
            publicDescription: hasPublicDesc,
            serviceableRegions: hasRegions,
            profileImageUrl: hasProfileImage,
            logoUrl: hasLogo,
            reviewLinks: hasReviewLinks,
          };

          const passedCount = Object.values(checklist).filter(Boolean).length;
          const score = Math.round((passedCount / 6) * 100);
          const passed = passedCount === 6;

          if (passed) {
            totalPassed++;
          } else {
            totalFailed++;
          }

          weeklyAudits.push({
            orgId,
            orgName: org.name || `Organization ${orgId}`,
            publicProfileEnabled,
            profileSlug: org.profileSlug || "",
            checklist,
            recommendations,
            score,
            passed,
          });
        }
      }

      // Format weekly document ID based on current Sunday
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const weekId = `${year}-${month}-${day}`;

      const weeklyReport = {
        weekId,
        createdAt: now.toISOString(),
        stats: {
          totalAudited,
          totalPassed,
          totalFailed,
        },
        organizations: weeklyAudits,
      };

      await db.collection("seoAlerts").doc(weekId).set(weeklyReport);
      functions.logger.info(`Successfully finished weekly SEO Auditor run. Audited: ${totalAudited}, Passed: ${totalPassed}, Failed: ${totalFailed}. Document ID: ${weekId}`);
    } catch (error) {
      functions.logger.error("Error running weekly SEO Auditor:", error);
      throw error;
    }
  });
