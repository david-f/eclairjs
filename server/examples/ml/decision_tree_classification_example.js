/*
 * Copyright 2016 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 Usage:
 bin/eclairjs.sh examples/ml/decision_tree_classification_example.js"
 */


function run(spark) {

    var StringIndexer = require('eclairjs/ml/feature/StringIndexer');
    var IndexToString = require('eclairjs/ml/feature/IndexToString');
    var VectorIndexer = require('eclairjs/ml/feature/VectorIndexer');
    var DecisionTreeClassifier = require('eclairjs/ml/classification/DecisionTreeClassifier');
    var MulticlassClassificationEvaluator = require('eclairjs/ml/evaluation/MulticlassClassificationEvaluator');
    var Pipeline = require('eclairjs/ml/Pipeline');

    // Load the data stored in LIBSVM format as a DataFrame.
    var data = spark
        .read()
        .format("libsvm")
        .load("examples/data/mllib/sample_libsvm_data.txt");

    // Index labels, adding metadata to the label column.
    // Fit on whole dataset to include all labels in index.
    var labelIndexer = new StringIndexer()
        .setInputCol("label")
        .setOutputCol("indexedLabel")
        .fit(data);

    // Automatically identify categorical features, and index them.
    var featureIndexer = new VectorIndexer()
        .setInputCol("features")
        .setOutputCol("indexedFeatures")
        .setMaxCategories(4) // features with > 4 distinct values are treated as continuous
        .fit(data);

    // Split the data into training and test sets (30% held out for testing)
    var splits = data.randomSplit([0.7, 0.3]);
    var trainingData = splits[0];
    var testData = splits[1];

    // Train a DecisionTree model.
    var dt = new DecisionTreeClassifier()
        .setLabelCol("indexedLabel")
        .setFeaturesCol("indexedFeatures");

    // Convert indexed labels back to original labels.
    var labelConverter = new IndexToString()
        .setInputCol("prediction")
        .setOutputCol("predictedLabel")
        .setLabels(labelIndexer.labels());

    // Chain indexers and tree in a Pipeline
    var pipeline = new Pipeline()
        .setStages([labelIndexer, featureIndexer, dt, labelConverter]);

    // Train model.  This also runs the indexers.
    var model = pipeline.fit(trainingData);

    // Make predictions.
    var predictions = model.transform(testData);

    var ret = {};
    ret.predictions = predictions;


    // Select (prediction, true label) and compute test error
    var evaluator = new MulticlassClassificationEvaluator()
        .setLabelCol("indexedLabel")
        .setPredictionCol("prediction")
        .setMetricName("accuracy");
    ret.accuracy = evaluator.evaluate(predictions);
    ret.treeModel = model.stages()[2];
    return ret;


}

/*
 check if SparkSession is defined, if it is we are being run from Unit Test
 */

if (typeof sparkSession === 'undefined') {
    var SparkSession = require(EclairJS_Globals.NAMESPACE + '/sql/SparkSession');
    var spark = SparkSession
            .builder()
            .appName("JavaScript Decision Tree Classification Example")
            .getOrCreate();
    var result = run(spark);

    // Select example rows to display.
    result.predictions.select("predictedLabel", "label", "features").show(5);
    print("Test Error = " + (1.0 - result.accuracy));
    print("Learned classification tree model:\n" + result.treeModel.toDebugString());;
    spark.stop();
}



